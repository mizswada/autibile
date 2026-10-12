import { unbilledAppointmentsListWhere } from "~/server/utils/billingWhere";
import { reconcileAllUnbilled } from "~/server/utils/sessionBalance";

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

// Stale "to bill" markers (hand edits in the database, old races) heal themselves: at most
// once a minute per server process, while something is waiting to be billed.
const HEAL_INTERVAL_MS = 60 * 1000;
let lastHealAt = 0;

async function healUnbilledMarkers(prismaClient) {
  const now = Date.now();
  if (now - lastHealAt < HEAL_INTERVAL_MS) return;
  lastHealAt = now;
  try {
    await reconcileAllUnbilled(prismaClient);
  } catch (error) {
    console.error("Error healing unbilled markers:", error);
  }
}

export async function getAdminNotificationCounts(prismaClient) {
  const diaryWhere = diaryUnseenWhere();

  const [
    paymentPendingCount,
    accountRequestPendingCount,
    userApprovalPendingCount,
    diaryUnseenRows,
    toBillCountRaw,
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

  let toBillCount = toBillCountRaw;
  if (toBillCountRaw > 0) {
    await healUnbilledMarkers(prismaClient);
    toBillCount = await prismaClient.appointments.count({
      where: unbilledAppointmentsListWhere(),
    });
  }

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
