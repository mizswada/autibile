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
      deleted_at: null, // Only show non-deleted invoices
    };

    // Add status filter if provided
    if (status && ['Paid', 'Unpaid'].includes(status)) {
      whereClause.status = status;
    }

    // Fetch invoices from database with patient information
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
          },
        },
      },
    });

    // Transform the data to include patient names
    const transformedInvoices = invoices.map(invoice => ({
      invoice_id: invoice.invoice_id,
      patient_id: invoice.patient_id,
      patient_name: invoice.user_patients?.fullname || 'Unknown Patient',
      patient_nickname: invoice.user_patients?.nickname,
      invoice_type: invoice.invoice_type,
      description: invoice.description,
      amount: invoice.amount,
      date: invoice.date,
      status: invoice.status,
      created_at: invoice.created_at,
      update_at: invoice.update_at,
    }));

    // Get total count for pagination
    const totalCount = await prisma.invoice.count({
      where: whereClause,
    });

    return {
      statusCode: 200,
      message: "Invoices retrieved successfully",
      data: transformedInvoices,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + invoices.length < totalCount,
      },
    };

  } catch (error) {
    console.error("Error fetching invoices:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 