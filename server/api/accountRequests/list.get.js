import { requireAdmin } from "~/server/utils/reports/guard";
import {
  REQUEST_TYPES,
  getUserValidationForRequest,
} from "~/server/utils/accountRequestHelpers";

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

    const requests = await prisma.account_requests.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    const userIds = [
      ...new Set(
        requests.map((item) => item.user_id).filter((id) => Number.isInteger(id)),
      ),
    ];

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { userID: { in: userIds } },
          select: {
            userID: true,
            userEmail: true,
            userUsername: true,
            userPhone: true,
          },
        })
      : [];

    const userById = new Map(users.map((user) => [user.userID, user]));

    const data = requests.map((item, index) => {
      const user = item.user_id ? userById.get(item.user_id) : null;
      const validation = getUserValidationForRequest(item, user);
      const requestType = item.request_type || REQUEST_TYPES.ACCOUNT_DELETION;

      return {
        no: index + 1,
        requestId: item.request_id,
        requestType,
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
        emailMatches: validation.emailMatches,
        phoneMatches: validation.phoneMatches,
        registeredEmail: validation.registeredEmail,
        registeredPhone: validation.registeredPhone,
      };
    });

    return {
      statusCode: 200,
      message: "Success",
      data,
    };
  } catch (error) {
    console.error("GET /api/accountRequests/list error:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    };
  }
});
