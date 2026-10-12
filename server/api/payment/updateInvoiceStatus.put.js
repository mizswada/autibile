import { creditInvoiceSessions } from "~/server/utils/invoiceSessions";
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

    // Money actions are for administrators only (not for doctors / therapists).
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    const body = await readBody(event);
    const { invoiceID, status } = body;

    // Basic validation
    if (!invoiceID || !status) {
      return {
        statusCode: 400,
        message: "Missing required fields: invoiceID and status are required",
      };
    }

    // Validate status
    if (!['Paid', 'Unpaid'].includes(status)) {
      return {
        statusCode: 400,
        message: "Invalid status. Must be either 'Paid' or 'Unpaid'",
      };
    }

    // Validate invoiceID is a valid integer
    const invoiceIdValue = parseInt(invoiceID);
    if (isNaN(invoiceIdValue) || invoiceIdValue <= 0) {
      return {
        statusCode: 400,
        message: "Invalid invoice ID",
      };
    }

    // Get the current invoice with patient information
    const currentInvoice = await prisma.invoice.findFirst({
      where: {
        invoice_id: invoiceIdValue,
        deleted_at: null,
      },
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            available_session: true,
          },
        },
      },
    });

    if (!currentInvoice) {
      return {
        statusCode: 404,
        message: "Invoice not found",
      };
    }

    if (currentInvoice.status === 'Void') {
      return {
        statusCode: 400,
        message: "This invoice is void and cannot be changed.",
      };
    }

    // A paid invoice with a recorded payment or credited sessions cannot be turned back into
    // Unpaid: the label would change but the money and the sessions would not, and it could be
    // paid a second time. Use "Adjust sessions" to correct sessions instead.
    if (status === 'Unpaid' && currentInvoice.status === 'Paid') {
      const approvedPayment = await prisma.payment.findFirst({
        where: { invoice_id: invoiceIdValue, status: 'Approved', deleted_at: null },
        select: { payment_id: true },
      });
      if (currentInvoice.sessions_credited || approvedPayment) {
        return {
          statusCode: 400,
          message: "This invoice has a recorded payment or credited sessions, so it cannot be marked Unpaid. Use Adjust sessions to correct the sessions.",
        };
      }
    }

    // Status change and session credit happen together. creditInvoiceSessions
    // credits at most once per invoice, so toggling Paid again never adds sessions twice.
    // The status is changed FIRST, so the session credit (and the matching of unbilled
    // appointments that follows it) already sees this invoice as Paid.
    const patientSelect = {
      user_patients: {
        select: {
          patient_id: true,
          fullname: true,
          available_session: true,
        },
      },
    };

    let updatedInvoice;
    try {
      updatedInvoice = await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: {
            invoice_id: invoiceIdValue,
          },
          data: {
            status: status,
            update_at: new Date(),
          },
        });

        if (status === 'Paid' && currentInvoice.status === 'Unpaid') {
          const result = await creditInvoiceSessions(invoiceIdValue, tx);
          if (result.reason === 'patient_inactive') {
            // Rolls the status change back as well.
            throw new Error('PATIENT_INACTIVE');
          }
        }

        // Read again so the returned balance includes the sessions just added.
        return tx.invoice.findUnique({
          where: { invoice_id: invoiceIdValue },
          include: patientSelect,
        });
      });
    } catch (txError) {
      if (txError?.message === 'PATIENT_INACTIVE') {
        return {
          statusCode: 400,
          message: "Cannot mark invoice as Paid: patient is inactive or deleted",
        };
      }
      throw txError;
    }

    return {
      statusCode: 200,
      message: "Invoice status updated successfully",
      data: {
        invoice_id: updatedInvoice.invoice_id,
        patient_id: updatedInvoice.patient_id,
        patient_name: updatedInvoice.user_patients?.fullname,
        invoice_type: updatedInvoice.invoice_type,
        status: updatedInvoice.status,
        available_sessions: Math.max(0, updatedInvoice.user_patients?.available_session || 0),
        updated_at: updatedInvoice.update_at,
      },
    };

  } catch (error) {
    console.error("Error updating invoice status:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 