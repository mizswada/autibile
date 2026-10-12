/**
 * Single place that changes a patient's session balance (user_patients.available_session).
 *
 * - Every change is an atomic increment / decrement, so overlapping requests cannot lose an update.
 * - The balance may go negative ("owed" sessions) down to -MAX_UNBILLED_SESSIONS.
 *   A cap of 0 keeps the old rule: booking is refused when the patient has no sessions.
 * - All helpers take a Prisma client (usually the `tx` of a $transaction).
 */

import { unbilledAppointmentsWhere } from "~/server/utils/billingWhere";
import { linkCoveredAppointments } from "~/server/utils/coverage";

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
 * The server runs as several processes (pm2 cluster), so an in-memory lock is not enough.
 * Every read here is a locking read (SELECT ... FOR UPDATE): it sees the latest committed
 * data instead of the transaction's older snapshot, and it makes two overlapping
 * reconciles for the same patient wait for each other.
 *
 * Call it AFTER the cancelled / deleted appointment's own billing fields were cleared.
 * Returns how many appointments were marked as covered.
 */
export async function reconcileUnbilled(db, patientId) {
  const balanceRows = await db.$queryRaw`
    SELECT available_session FROM user_patients WHERE patient_id = ${patientId} FOR UPDATE`;
  const balance = Number(balanceRows?.[0]?.available_session ?? 0);
  const owed = Math.max(0, -balance);

  const unbilled = await db.$queryRaw`
    SELECT appointment_id FROM appointments
    WHERE patient_id = ${patientId} AND deleted_at IS NULL AND needs_billing = 1
      AND billing_waived = 0 AND invoice_id IS NULL AND status <> 37
    ORDER BY date ASC, appointment_id ASC
    FOR UPDATE`;
  if (!unbilled.length) return 0;

  // Appointments billed on an unpaid invoice still count as owed until that invoice is paid.
  const billedUnpaidRows = await db.$queryRaw`
    SELECT a.appointment_id FROM appointments a
    JOIN invoice i ON i.invoice_id = a.invoice_id
    WHERE a.patient_id = ${patientId} AND a.deleted_at IS NULL AND a.status <> 37
      AND a.billing_waived = 0 AND i.status = 'Unpaid'
    FOR UPDATE`;
  const billedUnpaid = billedUnpaidRows.length;

  const stillUnbilled = Math.max(0, owed - billedUnpaid);
  const excess = unbilled.length - stillUnbilled;
  if (excess <= 0) return 0;

  // Sessions are used in order, so the oldest unbilled appointments are the covered ones.
  const coveredIds = unbilled.slice(0, excess).map((a) => Number(a.appointment_id));
  await db.appointments.updateMany({
    where: { appointment_id: { in: coveredIds }, invoice_id: null },
    data: { needs_billing: false, updated_at: new Date() },
  });
  // Show which paid invoice covers them (best effort, informational).
  await linkCoveredAppointments(db, patientId, coveredIds);
  return excess;
}

/**
 * The opposite of reconcileUnbilled: after the balance GOES DOWN (a refund took sessions
 * back, an admin removed sessions) a negative balance may no longer be explained by the
 * unbilled appointments. The newest appointments that were treated as prepaid are marked
 * "needs billing" again so they show up in To Bill. Returns how many were marked.
 */
export async function flagUncoveredAppointments(db, patientId) {
  const balanceRows = await db.$queryRaw`
    SELECT available_session FROM user_patients WHERE patient_id = ${patientId} FOR UPDATE`;
  const owed = Math.max(0, -Number(balanceRows?.[0]?.available_session ?? 0));
  if (owed === 0) return 0;

  const unbilled = await db.$queryRaw`
    SELECT appointment_id FROM appointments
    WHERE patient_id = ${patientId} AND deleted_at IS NULL AND needs_billing = 1
      AND billing_waived = 0 AND invoice_id IS NULL AND status <> 37
    FOR UPDATE`;
  const billedUnpaid = await db.$queryRaw`
    SELECT a.appointment_id FROM appointments a
    JOIN invoice i ON i.invoice_id = a.invoice_id
    WHERE a.patient_id = ${patientId} AND a.deleted_at IS NULL AND a.status <> 37
      AND a.billing_waived = 0 AND i.status = 'Unpaid'
    FOR UPDATE`;

  const shortage = owed - unbilled.length - billedUnpaid.length;
  if (shortage <= 0) return 0;

  // Sessions are used in order, so the newest appointments are the ones left uncovered.
  const candidates = await db.$queryRaw`
    SELECT appointment_id FROM appointments
    WHERE patient_id = ${patientId} AND deleted_at IS NULL AND needs_billing = 0
      AND billing_waived = 0 AND invoice_id IS NULL AND status <> 37
    ORDER BY date DESC, appointment_id DESC
    LIMIT ${shortage}
    FOR UPDATE`;
  if (!candidates.length) return 0;

  await db.appointments.updateMany({
    where: {
      appointment_id: { in: candidates.map((a) => Number(a.appointment_id)) },
      invoice_id: null,
    },
    data: { needs_billing: true, updated_at: new Date() },
  });
  return candidates.length;
}

/**
 * Self-healing pass: re-checks every patient that still has an unbilled marker. Fixes markers
 * left behind by hand edits in the database or by an old race. It only ever clears markers
 * that the balance already covers, so it is safe to run at any time.
 * Returns how many appointments were cleared.
 */
export async function reconcileAllUnbilled(client = prisma) {
  const rows = await client.appointments.findMany({
    where: unbilledAppointmentsWhere(),
    distinct: ["patient_id"],
    select: { patient_id: true },
  });

  let cleared = 0;
  for (const { patient_id: patientId } of rows) {
    cleared += await client.$transaction((tx) => reconcileUnbilled(tx, patientId));
  }
  return cleared;
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

  // Giving sessions can cover appointments that were waiting to be billed; removing them
  // can leave appointments uncovered.
  if (delta > 0) {
    await reconcileUnbilled(db, patientId);
  } else if (delta < 0) {
    await flagUncoveredAppointments(db, patientId);
  }

  return { balanceBefore, balanceAfter };
}
