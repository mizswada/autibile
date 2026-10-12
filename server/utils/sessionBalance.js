/**
 * Single place that changes a patient's session balance (user_patients.available_session).
 *
 * - Every change is an atomic increment / decrement, so overlapping requests cannot lose an update.
 * - The balance may go negative ("owed" sessions) down to -MAX_UNBILLED_SESSIONS.
 *   A cap of 0 keeps the old rule: booking is refused when the patient has no sessions.
 * - All helpers take a Prisma client (usually the `tx` of a $transaction).
 */

import { unbilledAppointmentsWhere } from "~/server/utils/adminNotifications";

export const MAX_UNBILLED_SETTING_KEY = "MAX_UNBILLED_SESSIONS";
export const DEFAULT_MAX_UNBILLED = 5;
export const MAX_UNBILLED_LIMIT = 50;

/** Max owed (unbilled) sessions per patient, from app_settings; defaults to 5. */
export async function getMaxUnbilled(db = prisma) {
  const row = await db.app_settings.findUnique({
    where: { setting_key: MAX_UNBILLED_SETTING_KEY },
  });
  const value = parseInt(row?.setting_value, 10);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_MAX_UNBILLED;
}

/** The column is nullable and an increment on NULL stays NULL, so make it 0 first. */
export async function ensureBalance(db, patientId) {
  await db.user_patients.updateMany({
    where: { patient_id: patientId, available_session: null },
    data: { available_session: 0 },
  });
}

async function readBalance(db, patientId) {
  const patient = await db.user_patients.findUnique({
    where: { patient_id: patientId },
    select: { available_session: true },
  });
  return patient?.available_session ?? 0;
}

/**
 * Use one session for a booking. Throws when the cap of unbilled sessions is reached.
 * Returns { balanceAfter, needsBilling }: needsBilling is true when the balance went
 * below zero, i.e. the booking is not covered by a prepaid session.
 */
export async function takeSession(db, patientId, { maxUnbilled } = {}) {
  await ensureBalance(db, patientId);
  const cap = maxUnbilled ?? (await getMaxUnbilled(db));

  const claim = await db.user_patients.updateMany({
    where: { patient_id: patientId, available_session: { gt: 0 - cap } },
    data: { available_session: { decrement: 1 }, update_at: new Date() },
  });

  if (claim.count === 0) {
    const patient = await db.user_patients.findUnique({
      where: { patient_id: patientId },
      select: { fullname: true, available_session: true },
    });
    const name = patient?.fullname || "The patient";
    const balance = patient?.available_session ?? 0;
    throw new Error(
      cap === 0
        ? `Cannot book. ${name} has no available sessions (${balance}). Please purchase more sessions first.`
        : `Cannot book. ${name} has reached the limit of ${cap} unbilled session(s). Please bill the unbilled sessions first.`,
    );
  }

  const balanceAfter = await readBalance(db, patientId);
  return { balanceAfter, needsBilling: balanceAfter < 0 };
}

/** Give one session back (cancelled / deleted / moved appointment). */
export async function releaseSession(db, patientId) {
  return creditSessions(db, patientId, 1);
}

/** Add sessions (paid package). Returns the new balance. */
export async function creditSessions(db, patientId, count) {
  await ensureBalance(db, patientId);
  await db.user_patients.update({
    where: { patient_id: patientId },
    data: { available_session: { increment: count }, update_at: new Date() },
  });
  return readBalance(db, patientId);
}

/**
 * Keep the "unbilled" markers honest after the balance GOES UP (a package was paid, a
 * booking was cancelled, sessions were given).
 *
 * A negative balance means "sessions used without being paid for". Those sessions are the
 * unbilled appointments plus the ones already billed on a still-unpaid invoice. When the
 * balance rises, the oldest unbilled appointments are covered by it, so they must stop
 * asking to be billed (otherwise the clinic could invoice them a second time).
 *
 * Call it AFTER the cancelled / deleted appointment's own billing fields were cleared.
 * Returns how many appointments were marked as covered.
 */
export async function reconcileUnbilled(db, patientId) {
  const balance = await readBalance(db, patientId);
  const owed = Math.max(0, -balance);

  const unbilled = await db.appointments.findMany({
    where: unbilledAppointmentsWhere({ patient_id: patientId }),
    select: { appointment_id: true },
    orderBy: [{ date: "asc" }, { appointment_id: "asc" }],
  });
  if (!unbilled.length) return 0;

  // Appointments billed on an unpaid invoice still count as owed until that invoice is paid.
  const billed = await db.appointments.findMany({
    where: {
      patient_id: patientId,
      deleted_at: null,
      status: { not: 37 },
      billing_waived: false,
      invoice_id: { not: null },
    },
    select: { invoice_id: true },
  });
  let billedUnpaid = 0;
  if (billed.length) {
    const invoiceIds = [...new Set(billed.map((a) => a.invoice_id))];
    const unpaid = await db.invoice.findMany({
      where: { invoice_id: { in: invoiceIds }, status: "Unpaid" },
      select: { invoice_id: true },
    });
    const unpaidIds = new Set(unpaid.map((invoice) => invoice.invoice_id));
    billedUnpaid = billed.filter((a) => unpaidIds.has(a.invoice_id)).length;
  }

  const stillUnbilled = Math.max(0, owed - billedUnpaid);
  const excess = unbilled.length - stillUnbilled;
  if (excess <= 0) return 0;

  // Sessions are used in order, so the oldest unbilled appointments are the covered ones.
  const coveredIds = unbilled.slice(0, excess).map((a) => a.appointment_id);
  await db.appointments.updateMany({
    where: { appointment_id: { in: coveredIds }, invoice_id: null },
    data: { needs_billing: false, updated_at: new Date() },
  });
  return excess;
}

/**
 * Manual admin correction. Always written together with a session_adjustment log row.
 * `admin` is { userID, email }.
 */
export async function adjustBalance(db, patientId, delta, { reason, admin, ip }) {
  await ensureBalance(db, patientId);
  const balanceBefore = await readBalance(db, patientId);

  await db.user_patients.update({
    where: { patient_id: patientId },
    data: { available_session: { increment: delta }, update_at: new Date() },
  });
  const balanceAfter = await readBalance(db, patientId);

  await db.session_adjustment.create({
    data: {
      patient_id: patientId,
      delta,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reason,
      admin_user_id: admin.userID,
      admin_email: admin.email || null,
      ip: ip || null,
    },
  });

  // Giving sessions can cover appointments that were waiting to be billed.
  if (delta > 0) {
    await reconcileUnbilled(db, patientId);
  }

  return { balanceBefore, balanceAfter };
}
