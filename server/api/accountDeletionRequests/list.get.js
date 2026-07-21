export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};

    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized",
      };
    }

    const validatedUser = await prisma.user.findFirst({
      where: { userID: parseInt(userID) },
    });

    if (!validatedUser) {
      return {
        statusCode: 401,
        message: "Unauthorized",
      };
    }

    const query = getQuery(event);
    const statusFilter = (query.status || "").trim();

    const where = {
      deleted_at: null,
    };

    if (statusFilter && statusFilter !== "All") {
      where.status = statusFilter;
    }

    const requests = await prisma.account_deletion_requests.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    const data = requests.map((item, index) => ({
      no: index + 1,
      requestId: item.request_id,
      fullName: item.full_name,
      email: item.email,
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
