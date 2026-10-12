const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SESSIONS_PREFIX = "Sessions: ";
const SEPARATOR = " - ";
const MAX_LENGTH = 500;

// DB dates are stored at UTC midnight, so read them in UTC.
export const formatShortDate = (date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;

/**
 * Keep the "Sessions: 12 Oct, 14 Oct" part of an Unpaid invoice's description in step with the
 * appointments it still bills (one of them may have been cancelled, deleted or moved).
 * Paid invoices keep their text as a record of what was billed.
 */
export async function refreshInvoiceSessionDates(db, invoiceId) {
  if (!invoiceId) return;

  const invoice = await db.invoice.findFirst({
    where: { invoice_id: invoiceId, deleted_at: null, status: "Unpaid" },
    select: { description: true },
  });
  if (!invoice) return;

  const billed = await db.appointments.findMany({
    where: { invoice_id: invoiceId, needs_billing: true, deleted_at: null, status: { not: 37 } },
    select: { date: true },
    orderBy: [{ date: "asc" }, { appointment_id: "asc" }],
  });

  const parts = String(invoice.description || "")
    .split(SEPARATOR)
    .filter((part) => part && !part.startsWith(SESSIONS_PREFIX));
  if (billed.length) {
    parts.splice(1, 0, `${SESSIONS_PREFIX}${billed.map((a) => formatShortDate(a.date)).join(", ")}`);
  }

  let description = parts.join(SEPARATOR);
  if (description.length > MAX_LENGTH) description = `${description.slice(0, MAX_LENGTH - 3)}...`;

  await db.invoice.updateMany({
    where: { invoice_id: invoiceId, status: "Unpaid" },
    data: { description, update_at: new Date() },
  });
}
