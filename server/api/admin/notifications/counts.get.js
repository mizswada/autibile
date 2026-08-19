import prisma from "~/server/utils/prisma";
import { requireAdmin } from "~/server/utils/reports/guard";
import { getAdminNotificationCounts } from "~/server/utils/adminNotifications";

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    return {
      statusCode: guard.statusCode,
      message: guard.message,
    };
  }

  try {
    const data = await getAdminNotificationCounts(prisma);

    return {
      statusCode: 200,
      message: "Success",
      data,
    };
  } catch (error) {
    console.error("GET /api/admin/notifications/counts error:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    };
  }
});
