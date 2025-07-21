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

    // If status is being changed to 'Paid' and it was previously 'Unpaid'
    if (status === 'Paid' && currentInvoice.status === 'Unpaid') {
      // Check if this is a package invoice by looking for matching package
      const matchingPackage = await prisma.renamedpackage.findFirst({
        where: {
          package_name: currentInvoice.invoice_type,
          status: 'Active',
          deleted_at: null,
        },
      });

      if (matchingPackage && currentInvoice.patient_id) {
        // Add available sessions to the patient
        const currentSessions = currentInvoice.user_patients?.available_session || 0;
        const newSessions = currentSessions + (matchingPackage.avail_session || 0);

        // Update patient's available sessions
        await prisma.user_patients.update({
          where: {
            patient_id: currentInvoice.patient_id,
          },
          data: {
            available_session: newSessions,
            update_at: new Date(),
          },
        });

        console.log(`Added ${matchingPackage.avail_session} sessions to patient ${currentInvoice.patient_id}. New total: ${newSessions}`);
      }
    }

    // Update the invoice status
    const updatedInvoice = await prisma.invoice.update({
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

    return {
      statusCode: 200,
      message: "Invoice status updated successfully",
      data: {
        invoice_id: updatedInvoice.invoice_id,
        patient_id: updatedInvoice.patient_id,
        patient_name: updatedInvoice.user_patients?.fullname,
        invoice_type: updatedInvoice.invoice_type,
        status: updatedInvoice.status,
        available_sessions: updatedInvoice.user_patients?.available_session,
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