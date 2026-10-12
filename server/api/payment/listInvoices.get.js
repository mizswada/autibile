import { requireAdmin } from "~/server/utils/reports/guard";

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

    // Billing data is for administrators only (not for doctors / therapists).
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    // Get query parameters for filtering
    const query = getQuery(event);
    const { 
      status, 
      search, 
      limit = 50, 
      offset = 0,
      startDate,
      endDate,
      invoiceType,
      patient_id,
      payLater
    } = query;

    // Build where clause
    const whereClause = {
      deleted_at: null, // Only show non-deleted invoices
    };

    // Restrict to one patient (used by the patient profile)
    const patientIdValue = parseInt(patient_id);
    if (!isNaN(patientIdValue) && patientIdValue > 0) {
      whereClause.patient_id = patientIdValue;
    }

    // Zakat-labelled invoices (the label does not change how the invoice is paid)
    if (payLater === '1' || payLater === 'true') {
      whereClause.pay_later = true;
    }

    // Add status filter if provided
    if (status && ['Paid', 'Unpaid', 'Void'].includes(status)) {
      whereClause.status = status;
    }

    // Add invoice type filter if provided
    if (invoiceType) {
      whereClause.invoice_type = invoiceType;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate);
      }
    }

    // Add search filter if provided
    if (search) {
      // MySQL collations are case-insensitive; Prisma's `mode` is not supported on MySQL.
      whereClause.OR = [
        {
          description: {
            contains: search
          }
        },
        {
          user_patients: {
            fullname: {
              contains: search
            }
          }
        }
      ];
    }

    // Fetch invoices from database with patient information and payment details
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
        payment: {
          select: {
            payment_id: true,
            amount: true,
            method: true,
            bank_name: true,
            reference_code: true,
            status: true,
            created_at: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1, // Get the most recent payment
        },
        invoice_item: {
          orderBy: {
            item_id: 'asc',
          },
        },
      },
    });

    // Transform the data to include patient names and payment information
    const transformedInvoices = invoices.map(invoice => {
      const latestPayment = invoice.payment[0];
      return {
        invoice_id: invoice.invoice_id,
        patient_id: invoice.patient_id,
        patient_name: invoice.user_patients?.fullname || 'Unknown Patient',
        patient_nickname: invoice.user_patients?.nickname,
        invoice_type: invoice.invoice_type,
        description: invoice.description,
        amount: invoice.amount,
        date: invoice.date,
        status: invoice.status,
        pay_later: invoice.pay_later,
        sessions_credited: invoice.sessions_credited,
        void_reason: invoice.void_reason,
        items: invoice.invoice_item,
        payment_id: latestPayment?.payment_id || null,
        payment_date: latestPayment?.created_at || null,
        payment_method: latestPayment?.method || null,
        payment_reference: latestPayment?.reference_code || null,
        payment_status: latestPayment?.status || null,
        created_at: invoice.created_at,
        update_at: invoice.update_at,
      };
    });

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