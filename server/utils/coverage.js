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

/** Oldest Paid package invoice of the patient with sessions left, or null. */
export async function findCoveringInvoiceId(db, patientId) {
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

  for (const invoice of invoices) {
    const capacity = invoice.invoice_item.reduce((sum, item) => sum + (item.sessions || 0), 0);
    const used = await db.appointments.count({
      where: { invoice_id: invoice.invoice_id, deleted_at: null, status: { not: 37 } },
    });
    if (used < capacity) return invoice.invoice_id;
  }
  return null;
}

/**
 * Link prepaid appointments (needs_billing = false, no invoice yet) to the invoice that
 * paid for them. Best effort; returns how many were linked.
 */
export async function linkCoveredAppointments(db, patientId, appointmentIds) {
  let linked = 0;
  for (const appointmentId of appointmentIds) {
    const invoiceId = await findCoveringInvoiceId(db, patientId);
    if (invoiceId == null) break;
    const result = await db.appointments.updateMany({
      where: {
        appointment_id: appointmentId,
        needs_billing: false,
        billing_waived: false,
        invoice_id: null,
        deleted_at: null,
        status: { not: 37 },
      },
      data: { invoice_id: invoiceId },
    });
    linked += result.count;
  }
  return linked;
}
