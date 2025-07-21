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

    // Check if package exists and is not already deleted
    const existingPackage = await prisma.renamedpackage.findFirst({
      where: {
        package_id: parseInt(packageId),
        deleted_at: null,
      },
    });

    if (!existingPackage) {
      return {
        statusCode: 404,
        message: "Package not found or already deleted",
      };
    }

    // Soft delete the package
    const deletedPackage = await prisma.renamedpackage.update({
      where: {
        package_id: parseInt(packageId),
      },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Package deleted successfully",
      data: {
        package_id: deletedPackage.package_id,
        package_name: deletedPackage.package_name,
        deleted_at: deletedPackage.deleted_at,
      },
    };

  } catch (error) {
    console.error("Error deleting package:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 