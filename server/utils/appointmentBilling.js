/**
 * Billing state of an appointment ("book first, bill later").
 *
 *   covered        booked with a prepaid session
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

  if (appointment.invoice_id) {
    if (invoiceStatus === "Paid") return "paid";
    if (invoiceStatus === "Unpaid") return "billed_unpaid";
    // Void or missing invoice: the appointment is waiting for billing again.
    return appointment.needs_billing ? "unbilled" : "covered";
  }

  return appointment.needs_billing ? "unbilled" : "covered";
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
    return {
      ...event,
      extendedProps: {
        ...event.extendedProps,
        needs_billing: !!appointment.needs_billing,
        billing_waived: !!appointment.billing_waived,
        invoice_id: appointment.invoice_id ?? null,
        invoice_status: invoiceStatus ?? null,
        billing_state: deriveBillingState(appointment, invoiceStatus),
      },
    };
  });
}
