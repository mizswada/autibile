/**
 * Optimistic concurrency for appointment edits.
 *
 * The handlers read the appointment BEFORE their transaction and decide from it whether a
 * session must be given back or taken. Two overlapping requests (a double click, two admins,
 * admin + therapist app) would both read "Booked" and both give the session back, so the
 * patient would gain a free session. Inside the transaction the row is locked and compared
 * with what was read; if it changed meanwhile the request stops with a clear message.
 */
const sameNullable = (a, b) => (a == null ? b == null : b != null && Number(a) === Number(b));
const flag = (value) => Boolean(Number(value));

export async function assertAppointmentUnchanged(tx, existing) {
  const rows = await tx.$queryRaw`
    SELECT status, patient_id, deleted_at, invoice_id, needs_billing, billing_waived
    FROM appointments WHERE appointment_id = ${existing.appointment_id} FOR UPDATE`;
  const row = rows?.[0];

  const unchanged =
    row &&
    sameNullable(row.status, existing.status) &&
    sameNullable(row.patient_id, existing.patient_id) &&
    (row.deleted_at == null) === (existing.deleted_at == null) &&
    sameNullable(row.invoice_id, existing.invoice_id) &&
    flag(row.needs_billing) === flag(existing.needs_billing) &&
    flag(row.billing_waived) === flag(existing.billing_waived);

  if (!unchanged) {
    throw new Error("This appointment was changed by someone else a moment ago. Refresh and try again.");
  }
}
