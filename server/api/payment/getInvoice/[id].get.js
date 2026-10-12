import { requireAdmin } from "~/server/utils/reports/guard";
import { sessionsOnInvoice } from "~/server/utils/invoiceSessions";

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
            status: true,
            deleted_at: true,
            available_session: true,
          },
        },
        invoice_item: {
          orderBy: {
            item_id: 'asc',
          },
        },
        payment: {
          where: { deleted_at: null },
          select: {
            payment_id: true,
            status: true,
            created_at: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!invoiceData) {
      return {
        statusCode: 404,
        message: "Invoice not found",
      };
    }

    // Appointments this invoice bills (booked earlier without a prepaid session)
    const billedAppointments = await prisma.appointments.findMany({
      where: { invoice_id: invoiceData.invoice_id, deleted_at: null },
      select: { appointment_id: true, date: true, status: true, needs_billing: true },
      orderBy: [{ date: 'asc' }, { appointment_id: 'asc' }],
    });

    // Sessions a refund would take back from the patient (only when this invoice credited them).
    const sessionsToTakeBack =
      invoiceData.status === 'Paid' && invoiceData.sessions_credited
        ? await sessionsOnInvoice(prisma, invoiceData)
        : 0;

    // Transform the data to include patient information
    const transformedInvoice = {
      invoice_id: invoiceData.invoice_id,
      patient_id: invoiceData.patient_id,
      patient_name: invoiceData.user_patients?.fullname || 'Unknown Patient',
      patient_nickname: invoiceData.user_patients?.nickname,
      patient_inactive: !!invoiceData.user_patients && (!!invoiceData.user_patients.deleted_at || String(invoiceData.user_patients.status || '').toLowerCase() !== 'active'),
      patient_available_sessions: Math.max(0, invoiceData.user_patients?.available_session || 0),
      patient_balance: invoiceData.user_patients?.available_session || 0,
      sessions_to_take_back: sessionsToTakeBack,
      invoice_type: invoiceData.invoice_type,
      description: invoiceData.description,
      amount: invoiceData.amount,
      date: invoiceData.date,
      status: invoiceData.status,
      pay_later: invoiceData.pay_later,
      sessions_credited: invoiceData.sessions_credited,
      void_reason: invoiceData.void_reason,
      voided_at: invoiceData.voided_at,
      // needs_billing: billed on this invoice; otherwise a prepaid session taken from it.
      billed_appointments: billedAppointments.filter((a) => a.needs_billing),
      covered_appointments: billedAppointments.filter((a) => !a.needs_billing),
      items: invoiceData.invoice_item,
      latest_payment: invoiceData.payment[0] || null,
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