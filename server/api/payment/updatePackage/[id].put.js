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

    const body = await readBody(event);

    const {
      packageName,
      description,
      amount,
      availableSessions,
      status,
    } = body;

    // Basic validation
    if (!packageName || !description || !amount || !availableSessions || !status) {
      return {
        statusCode: 400,
        message: "Missing required fields: packageName, description, amount, availableSessions, and status are required",
      };
    }

    // Validate status
    if (!['Active', 'Inactive'].includes(status)) {
      return {
        statusCode: 400,
        message: "Invalid status. Must be either 'Active' or 'Inactive'",
      };
    }

    // Validate amount is a positive number
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return {
        statusCode: 400,
        message: "Amount must be a positive number",
      };
    }

    // Validate availableSessions is a positive integer
    const sessionsValue = parseInt(availableSessions);
    if (isNaN(sessionsValue) || sessionsValue <= 0) {
      return {
        statusCode: 400,
        message: "Available sessions must be a positive integer",
      };
    }

    // Check if package exists
    const existingPackage = await prisma.renamedpackage.findFirst({
      where: {
        package_id: parseInt(packageId),
        deleted_at: null,
      },
    });

    if (!existingPackage) {
      return {
        statusCode: 404,
        message: "Package not found",
      };
    }

    // Update package record
    const updatedPackage = await prisma.renamedpackage.update({
      where: {
        package_id: parseInt(packageId),
      },
      data: {
        package_name: packageName,
        description: description,
        amount: amountValue,
        avail_session: sessionsValue,
        status: status,
        updated_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Package updated successfully",
      data: {
        package_id: updatedPackage.package_id,
        package_name: updatedPackage.package_name,
        description: updatedPackage.description,
        amount: updatedPackage.amount,
        avail_session: updatedPackage.avail_session,
        status: updatedPackage.status,
        updated_at: updatedPackage.updated_at,
      },
    };

  } catch (error) {
    console.error("Error updating package:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 