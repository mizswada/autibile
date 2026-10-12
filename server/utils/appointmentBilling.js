/**
 * Billing state of an appointment ("book first, bill later").
 *
 *   covered        booked with a prepaid session (invoice_id, when set, is the paid
 *                  invoice it was taken from: needs_billing is false)
 *   unbilled       booked with no prepaid session and no invoice yet
 *   billed_unpaid  linked to an invoice that is still Unpaid
 *   paid           linked to a Paid invoice
 *   waived         the clinic decided not to charge for it
 *   null           cancelled (nothing to bill)
 *
 * Paid / Unpaid always comes from the invoice, never from the link itself.
 */

export function deriveBillingState(appointment, invoiceStatus) {
  if (appointment.status === 37) return null;
  if (appointment.billing_waived) return "waived";

  // Prepaid appointment, possibly linked to the invoice that paid for it.
  if (!appointment.needs_billing) return "covered";

  if (appointment.invoice_id) {
    if (invoiceStatus === "Paid") return "paid";
    if (invoiceStatus === "Unpaid") return "billed_unpaid";
    // Void or missing invoice: the appointment is waiting for billing again.
    return "unbilled";
  }

  return "unbilled";
}

/**
 * Adds billing fields to already formatted calendar events (same order as `appointments`).
 * Admin responses only: billing data must not reach doctors or the mobile app.
 */
export async function attachBillingToEvents(db, appointments, events) {
  const invoiceIds = [
    ...new Set(appointments.map((a) => a.invoice_id).filter((id) => id != null)),
  ];

  const statusByInvoice = {};
  if (invoiceIds.length) {
    const invoices = await db.invoice.findMany({
      where: { invoice_id: { in: invoiceIds } },
      select: { invoice_id: true, status: true },
    });
    for (const invoice of invoices) {
      statusByInvoice[invoice.invoice_id] = invoice.status;
    }
  }

  return events.map((event, index) => {
    const appointment = appointments[index];
    const invoiceStatus = appointment.invoice_id
      ? statusByInvoice[appointment.invoice_id]
      : null;
    const billingState = deriveBillingState(appointment, invoiceStatus);
    const isCovered = billingState === "covered";
    return {
      ...event,
      extendedProps: {
        ...event.extendedProps,
        needs_billing: !!appointment.needs_billing,
        billing_waived: !!appointment.billing_waived,
        // invoice_id = the invoice that BILLS it; covered_by_invoice_id = the paid invoice
        // a prepaid appointment was taken from.
        invoice_id: isCovered ? null : appointment.invoice_id ?? null,
        invoice_status: isCovered ? null : invoiceStatus ?? null,
        covered_by_invoice_id: isCovered ? appointment.invoice_id ?? null : null,
        billing_state: billingState,
      },
    };
  });
}
