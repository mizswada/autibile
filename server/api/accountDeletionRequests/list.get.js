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
    const query = getQuery(event);
    const statusFilter = (query.status || "").trim();
    const requestTypeFilter = (query.requestType || query.request_type || "").trim();

    const where = {
      deleted_at: null,
    };

    if (statusFilter && statusFilter !== "All") {
      where.status = statusFilter;
    }

    if (requestTypeFilter && requestTypeFilter !== "All") {
      where.request_type = requestTypeFilter;
    }

    const requests = await prisma.account_deletion_requests.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    const data = requests.map((item, index) => ({
      no: index + 1,
      requestId: item.request_id,
      requestType: item.request_type || "AccountDeletion",
      fullName: item.full_name,
      email: item.email,
      phoneNumber: item.phone_number || "",
      userId: item.user_id,
      accountType: item.account_type,
      additionalInfo: item.additional_info || "",
      status: item.status,
      adminNotes: item.admin_notes || "",
      processedBy: item.processed_by,
      processedAt: item.processed_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return {
      statusCode: 200,
      message: "Success",
      data,
    };
  } catch (error) {
    console.error("GET /api/accountDeletionRequests/list error:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    };
  }
});
