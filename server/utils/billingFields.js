/** Billing columns of an appointment row: administrators only. */
const BILLING_FIELDS = ["needs_billing", "billing_waived", "invoice_id"];

export function withoutBillingFields(appointment) {
  if (!appointment || typeof appointment !== "object") return appointment;
  const copy = { ...appointment };
  for (const field of BILLING_FIELDS) delete copy[field];
  return copy;
}
