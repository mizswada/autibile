import prisma from "~/server/utils/prisma";
import { requireAdmin } from "~/server/utils/reports/guard";
import { diaryUnseenWhere } from "~/server/utils/adminNotifications";

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    return {
      statusCode: guard.statusCode,
      message: guard.message,
    };
  }

  try {
    const body = await readBody(event);
    const patientID = parseInt(body?.patientID);

    if (isNaN(patientID) || patientID <= 0) {
      return {
        statusCode: 400,
        message: "Invalid patient ID",
      };
    }

    const result = await prisma.diary_report.updateMany({
      where: {
        ...diaryUnseenWhere(),
        patient_id: patientID,
      },
      data: {
        admin_seen_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Diary reports marked as seen",
      data: {
        updatedCount: result.count,
      },
    };
  } catch (error) {
    console.error("PUT /api/diaryReport/markSeen error:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    };
  }
});
