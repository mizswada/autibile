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

    // Get package ID from URL parameters
    const packageId = getRouterParam(event, 'id');
    
    if (!packageId || isNaN(parseInt(packageId))) {
      return {
        statusCode: 400,
        message: "Invalid package ID",
      };
    }

    // Fetch package from database
    const packageData = await prisma.renamedpackage.findFirst({
      where: {
        package_id: parseInt(packageId),
        deleted_at: null, // Only show non-deleted packages
      },
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

    if (!packageData) {
      return {
        statusCode: 404,
        message: "Package not found",
      };
    }

    return {
      statusCode: 200,
      message: "Package retrieved successfully",
      data: packageData,
    };

  } catch (error) {
    console.error("Error fetching package:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 