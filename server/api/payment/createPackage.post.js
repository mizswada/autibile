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

    // Create package record
    const packageData = await prisma.renamedpackage.create({
      data: {
        package_name: packageName,
        description: description,
        amount: amountValue,
        avail_session: sessionsValue,
        status: status,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    if (!packageData) {
      return {
        statusCode: 500,
        message: "Failed to create package",
      };
    }

    return {
      statusCode: 201,
      message: "Package created successfully",
      data: {
        package_id: packageData.package_id,
        package_name: packageData.package_name,
        description: packageData.description,
        amount: packageData.amount,
        avail_session: packageData.avail_session,
        status: packageData.status,
        created_at: packageData.created_at,
      },
    };

  } catch (error) {
    console.error("Error creating package:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 