/** Shared Prisma filters for the "book first, bill later" flow. */

/** Appointments booked without a prepaid session that no invoice bills yet. */
export function unbilledAppointmentsWhere(extra = {}) {
  return {
    deleted_at: null,
    needs_billing: true,
    billing_waived: false,
    invoice_id: null,
    status: { not: 37 },
    ...extra,
  };
}

/**
 * Same, for lists and counts: appointments of a deleted patient are left out.
 * (Mutations use unbilledAppointmentsWhere, which has no relation filter.)
 */
export function unbilledAppointmentsListWhere(extra = {}) {
  return unbilledAppointmentsWhere({
    user_patients: { is: { deleted_at: null } },
    ...extra,
  });
}
