import { creditInvoiceSessions } from "~/server/utils/invoiceSessions";

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

    // Status change and session credit happen together. creditInvoiceSessions
    // credits at most once per invoice, so toggling Paid again never adds sessions twice.
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      if (status === 'Paid' && currentInvoice.status === 'Unpaid') {
        const result = await creditInvoiceSessions(invoiceIdValue, tx);
        if (result.reason === 'patient_inactive') {
          return null;
        }
      }

      return tx.invoice.update({
        where: {
          invoice_id: invoiceIdValue,
        },
        data: {
          status: status,
          update_at: new Date(),
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
    });

    if (!updatedInvoice) {
      return {
        statusCode: 400,
        message: "Cannot mark invoice as Paid: patient is inactive or deleted",
      };
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