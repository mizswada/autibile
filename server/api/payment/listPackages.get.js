export default defineEventHandler(async (event) => {
  try {
    // Extract userID from the session context for authorization
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    // Get query parameters for filtering
    const query = getQuery(event);
    const { status, limit = 50, offset = 0 } = query;

    // Build where clause
    const whereClause = {
      deleted_at: null, // Only show non-deleted packages
    };

    // Add status filter if provided
    if (status && ['Active', 'Inactive'].includes(status)) {
      whereClause.status = status;
    }

    // Fetch packages from database
    const packages = await prisma.renamedpackage.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        package_id: true,
        package_name: true,
        description: true,
        amount: true,
        avail_session: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Get total count for pagination
    const totalCount = await prisma.renamedpackage.count({
      where: whereClause,
    });

    return {
      statusCode: 200,
      message: "Packages retrieved successfully",
      data: packages,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + packages.length < totalCount,
      },
    };

  } catch (error) {
    console.error("Error fetching packages:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 