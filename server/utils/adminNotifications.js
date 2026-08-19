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

export async function getAdminNotificationCounts(prismaClient) {
  const diaryWhere = diaryUnseenWhere();

  const [
    paymentPendingCount,
    accountRequestPendingCount,
    userApprovalPendingCount,
    diaryUnseenRows,
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
  };
}
