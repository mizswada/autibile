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

    // Get invoice ID from URL parameters
    const invoiceId = getRouterParam(event, 'id');
    
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return {
        statusCode: 400,
        message: "Invalid invoice ID",
      };
    }

    // Fetch invoice from database with patient information
    const invoiceData = await prisma.invoice.findFirst({
      where: {
        invoice_id: parseInt(invoiceId),
        deleted_at: null, // Only show non-deleted invoices
      },
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
            available_session: true,
          },
        },
      },
    });

    if (!invoiceData) {
      return {
        statusCode: 404,
        message: "Invoice not found",
      };
    }

    // Transform the data to include patient information
    const transformedInvoice = {
      invoice_id: invoiceData.invoice_id,
      patient_id: invoiceData.patient_id,
      patient_name: invoiceData.user_patients?.fullname || 'Unknown Patient',
      patient_nickname: invoiceData.user_patients?.nickname,
      patient_available_sessions: invoiceData.user_patients?.available_session || 0,
      invoice_type: invoiceData.invoice_type,
      description: invoiceData.description,
      amount: invoiceData.amount,
      date: invoiceData.date,
      status: invoiceData.status,
      created_at: invoiceData.created_at,
      update_at: invoiceData.update_at,
    };

    return {
      statusCode: 200,
      message: "Invoice retrieved successfully",
      data: transformedInvoice,
    };

  } catch (error) {
    console.error("Error fetching invoice:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 