import { requireAdmin } from "~/server/utils/reports/guard";

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    return {
      statusCode: guard.statusCode,
      message: guard.message,
    };
  }

  try {
    const pendingCount = await prisma.account_deletion_requests.count({
      where: {
        deleted_at: null,
        status: "Pending",
      },
    });

    return {
      statusCode: 200,
      message: "Success",
      data: { pendingCount },
    };
  } catch (error) {
    console.error("GET /api/accountDeletionRequests/pendingCount error:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    };
  }
});
