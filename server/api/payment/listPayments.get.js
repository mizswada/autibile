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
    const { 
      status, 
      method, 
      search, 
      limit = 50, 
      offset = 0,
      startDate,
      endDate
    } = query;

    // Build where clause
    const whereClause = {
      deleted_at: null, // Only show non-deleted payments
    };

    // Note: Payment table doesn't have a status field, so we'll filter based on other criteria
    // For now, we'll skip status filtering for payments

    // Add method filter if provided
    if (method && ['Online Banking', 'Credit Card', 'E-Wallet'].includes(method)) {
      whereClause.method = method;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at.lte = new Date(endDate);
      }
    }

    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        {
          reference_code: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          invoice: {
            description: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // Fetch payments from database with invoice and patient information
    const payments = await prisma.payment.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        invoice: {
          select: {
            invoice_id: true,
            description: true,
            amount: true,
            date: true,
            status: true,
          },
        },
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
          },
        },
      },
    });

    // Transform the data to include invoice and patient information
    const transformedPayments = payments.map(payment => ({
      payment_id: payment.payment_id,
      invoice_id: payment.invoice_id,
      invoice_description: payment.invoice?.description || 'N/A',
      invoice_amount: payment.invoice?.amount || 0,
      invoice_date: payment.invoice?.date,
      invoice_status: payment.invoice?.status || 'N/A',
      patient_id: payment.patient_id,
      patient_name: payment.user_patients?.fullname || 'Unknown Patient',
      patient_nickname: payment.user_patients?.nickname,
      amount: payment.amount,
      method: payment.method,
      bank_name: payment.bank_name,
      reference_code: payment.reference_code,
      status: 'Completed', // Since payment table doesn't have status, assume all payments are completed
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    }));

    // Get total count for pagination
    const totalCount = await prisma.payment.count({
      where: whereClause,
    });

    return {
      statusCode: 200,
      message: "Payments retrieved successfully",
      data: transformedPayments,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + payments.length < totalCount,
      },
    };

  } catch (error) {
    console.error("Error fetching payments:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 