/**
 * Labels for the billing state of an appointment (admins only).
 * The state itself is computed on the server (server/utils/appointmentBilling.js).
 * "covered" (booked with a prepaid session) has no label: there is nothing to chase.
 */
export const BILLING_STATE_META = {
  unbilled: {
    label: 'Unbilled',
    badgeClass: 'bg-amber-100 text-amber-800',
    symbol: '$',
  },
  billed_unpaid: {
    label: 'Billed, unpaid',
    badgeClass: 'bg-orange-100 text-orange-800',
    symbol: '$',
  },
  paid: {
    label: 'Paid',
    badgeClass: 'bg-green-100 text-green-800',
    symbol: '$',
  },
  waived: {
    label: 'Waived',
    badgeClass: 'bg-gray-100 text-gray-700',
    symbol: '$',
  },
};

/** Meta for a billing state, or null when nothing should be shown. */
export function getBillingStateMeta(state) {
  return BILLING_STATE_META[state] || null;
}

export function formatInvoiceNumber(id) {
  return `INV-${String(id).padStart(3, '0')}`;
}
