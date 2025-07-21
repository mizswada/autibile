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

    // Get payment ID from URL parameters
    const paymentId = getRouterParam(event, 'id');
    
    if (!paymentId || isNaN(parseInt(paymentId))) {
      return {
        statusCode: 400,
        message: "Invalid payment ID",
      };
    }

    // Fetch payment from database with invoice and patient information
    const paymentData = await prisma.payment.findFirst({
      where: {
        payment_id: parseInt(paymentId),
        deleted_at: null, // Only show non-deleted payments
      },
      include: {
        invoice: {
          select: {
            invoice_id: true,
            description: true,
            amount: true,
            date: true,
            status: true,
            invoice_type: true,
          },
        },
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

    if (!paymentData) {
      return {
        statusCode: 404,
        message: "Payment not found",
      };
    }

    // Transform the data to include invoice and patient information
    const transformedPayment = {
      payment_id: paymentData.payment_id,
      invoice_id: paymentData.invoice_id,
      invoice_description: paymentData.invoice?.description || 'N/A',
      invoice_amount: paymentData.invoice?.amount || 0,
      invoice_date: paymentData.invoice?.date,
      invoice_status: paymentData.invoice?.status || 'N/A',
      invoice_type: paymentData.invoice?.invoice_type || 'N/A',
      patient_id: paymentData.patient_id,
      patient_name: paymentData.user_patients?.fullname || 'Unknown Patient',
      patient_nickname: paymentData.user_patients?.nickname,
      patient_available_sessions: paymentData.user_patients?.available_session || 0,
      amount: paymentData.amount,
      method: paymentData.method,
      bank_name: paymentData.bank_name,
      reference_code: paymentData.reference_code,
      status: 'Completed', // Since payment table doesn't have status, assume all payments are completed
      created_at: paymentData.created_at,
      updated_at: paymentData.updated_at,
    };

    return {
      statusCode: 200,
      message: "Payment retrieved successfully",
      data: transformedPayment,
    };

  } catch (error) {
    console.error("Error fetching payment:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 