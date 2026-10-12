/**
 * "Covered by invoice": which paid package invoice a prepaid appointment was taken from.
 *
 * An appointment booked with a prepaid session has needs_billing = false. It is linked
 * (appointments.invoice_id) to the oldest Paid invoice that still has package sessions
 * left, so the admin can see "Sessions used" on the invoice and "Covered by INV-x" on the
 * appointment. The link is informational: the session balance stays the source of truth
 * and an appointment may stay unlinked (sessions added by hand, older invoices).
 *
 * needs_billing = false + invoice_id set means "covered by that invoice";
 * needs_billing = true + invoice_id set means "billed on that invoice".
 */

/**
 * Paid package invoices of the patient with sessions left, oldest first, as
 * [{ invoiceId, remaining }]. Three queries however many sessions are linked.
 */
async function invoicesWithCapacity(db, patientId) {
  const invoices = await db.invoice.findMany({
    where: {
      patient_id: patientId,
      status: "Paid",
      deleted_at: null,
      sessions_credited: true,
      invoice_item: { some: { item_type: "Package", sessions: { gt: 0 } } },
    },
    select: {
      invoice_id: true,
      invoice_item: { where: { item_type: "Package" }, select: { sessions: true } },
    },
    orderBy: [{ date: "asc" }, { invoice_id: "asc" }],
  });
  if (!invoices.length) return [];

  const usage = await db.appointments.groupBy({
    by: ["invoice_id"],
    where: {
      invoice_id: { in: invoices.map((invoice) => invoice.invoice_id) },
      deleted_at: null,
      status: { not: 37 },
    },
    _count: { _all: true },
  });
  const used = new Map(usage.map((row) => [row.invoice_id, row._count._all]));

  return invoices
    .map((invoice) => ({
      invoiceId: invoice.invoice_id,
      remaining:
        invoice.invoice_item.reduce((sum, item) => sum + (item.sessions || 0), 0) -
        (used.get(invoice.invoice_id) || 0),
    }))
    .filter((entry) => entry.remaining > 0);
}

/** Oldest Paid package invoice of the patient with sessions left, or null. */
export async function findCoveringInvoiceId(db, patientId) {
  const [first] = await invoicesWithCapacity(db, patientId);
  return first ? first.invoiceId : null;
}

/**
 * Link prepaid appointments (needs_billing = false, no invoice yet) to the invoice that
 * paid for them, oldest invoice first. Best effort; returns how many were linked.
 */
export async function linkCoveredAppointments(db, patientId, appointmentIds) {
  if (!appointmentIds.length) return 0;
  const capacity = await invoicesWithCapacity(db, patientId);

  let linked = 0;
  let next = 0;
  for (const entry of capacity) {
    if (next >= appointmentIds.length) break;
    const batch = appointmentIds.slice(next, next + entry.remaining);
    const result = await db.appointments.updateMany({
      where: {
        appointment_id: { in: batch },
        needs_billing: false,
        billing_waived: false,
        invoice_id: null,
        deleted_at: null,
        status: { not: 37 },
      },
      data: { invoice_id: entry.invoiceId },
    });
    linked += result.count;
    next += batch.length;
  }
  return linked;
}
