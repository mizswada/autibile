import { unbilledAppointmentsListWhere } from "~/server/utils/billingWhere";

/**
 * Money and sessions still open for the children of a parent account.
 * Used before an account deletion is approved: the children are deactivated then, so unpaid
 * invoices can no longer be paid and unbilled sessions drop out of the To Bill list.
 * Returns null when nothing is open.
 */
export async function getParentOutstanding(db, userId) {
  const parent = await db.user_parents.findFirst({
    where: { user_id: userId, deleted_at: null },
    select: { parent_id: true },
  });
  if (!parent) return null;

  const links = await db.user_parent_patient.findMany({
    where: { parent_id: parent.parent_id },
    select: { patient_id: true },
  });
  const patientIds = links.map((link) => link.patient_id);
  if (!patientIds.length) return null;

  const [unpaid, unbilledSessions, pendingPayments] = await Promise.all([
    db.invoice.aggregate({
      where: { patient_id: { in: patientIds }, status: "Unpaid", deleted_at: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.appointments.count({ where: unbilledAppointmentsListWhere({ patient_id: { in: patientIds } }) }),
    db.payment.count({ where: { patient_id: { in: patientIds }, status: "Pending", deleted_at: null } }),
  ]);

  const result = {
    unpaidInvoices: unpaid._count._all,
    unpaidAmount: Number(unpaid._sum.amount || 0),
    unbilledSessions,
    pendingPayments,
  };
  return result.unpaidInvoices || result.unbilledSessions || result.pendingPayments ? result : null;
}
