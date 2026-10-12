export const DIARY_UNSEEN_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getDiaryUnseenSince(now = new Date()) {
  return new Date(now.getTime() - DIARY_UNSEEN_WINDOW_MS);
}

export function diaryUnseenWhere(now = new Date()) {
  return {
    deleted_at: null,
    admin_seen_at: null,
    created_at: { gte: getDiaryUnseenSince(now) },
  };
}

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

export async function getAdminNotificationCounts(prismaClient) {
  const diaryWhere = diaryUnseenWhere();

  const [
    paymentPendingCount,
    accountRequestPendingCount,
    userApprovalPendingCount,
    diaryUnseenRows,
    toBillCount,
  ] = await Promise.all([
    prismaClient.payment.count({
      where: {
        status: "Pending",
        deleted_at: null,
      },
    }),
    prismaClient.account_requests.count({
      where: {
        status: "Pending",
        deleted_at: null,
      },
    }),
    prismaClient.user_practitioners.count({
      where: {
        status: "Pending",
        deleted_at: null,
      },
    }),
    prismaClient.diary_report.findMany({
      where: diaryWhere,
      select: { patient_id: true },
    }),
    prismaClient.appointments.count({
      where: unbilledAppointmentsListWhere(),
    }),
  ]);

  const diaryUnseenPatientIds = [
    ...new Set(
      diaryUnseenRows
        .map((row) => row.patient_id)
        .filter((patientId) => patientId != null)
    ),
  ];

  return {
    paymentPendingCount,
    diaryUnseenCount: diaryUnseenRows.length,
    accountRequestPendingCount,
    userApprovalPendingCount,
    diaryUnseenPatientIds,
    toBillCount,
  };
}
