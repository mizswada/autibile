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
      invoiceID,
      patientID,
      amount,
      method,
      bank_name,
      reference_code,
    } = body;

    // Basic validation
    if (!invoiceID || !patientID || !amount || !method || !bank_name || !reference_code) {
      return {
        statusCode: 400,
        message: "Missing required fields: invoiceID, patientID, amount, method, bank_name, and reference_code are required",
      };
    }

    // Validate method
    if (!['Online Banking', 'Credit Card', 'E-Wallet'].includes(method)) {
      return {
        statusCode: 400,
        message: "Invalid payment method. Must be 'Online Banking', 'Credit Card', or 'E-Wallet'",
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

    // Validate IDs are valid integers
    const invoiceIdValue = parseInt(invoiceID);
    const patientIdValue = parseInt(patientID);
    
    if (isNaN(invoiceIdValue) || invoiceIdValue <= 0) {
      return {
        statusCode: 400,
        message: "Invalid invoice ID",
      };
    }

    if (isNaN(patientIdValue) || patientIdValue <= 0) {
      return {
        statusCode: 400,
        message: "Invalid patient ID",
      };
    }

    // Verify invoice exists and is unpaid
    const invoice = await prisma.invoice.findFirst({
      where: {
        invoice_id: invoiceIdValue,
        deleted_at: null,
      },
    });

    if (!invoice) {
      return {
        statusCode: 404,
        message: "Invoice not found",
      };
    }

    if (invoice.status === 'Paid') {
      return {
        statusCode: 400,
        message: "Invoice is already paid",
      };
    }

    // Verify patient exists
    const patient = await prisma.user_patients.findFirst({
      where: {
        patient_id: patientIdValue,
        deleted_at: null,
      },
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    // Create payment record
    const paymentData = await prisma.payment.create({
      data: {
        patient_id: patientIdValue,
        invoice_id: invoiceIdValue,
        amount: amountValue,
        method: method,
        bank_name: bank_name,
        reference_code: reference_code,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    if (!paymentData) {
      return {
        statusCode: 500,
        message: "Failed to create payment record",
      };
    }

    // Update invoice status to Paid
    await prisma.invoice.update({
      where: {
        invoice_id: invoiceIdValue,
      },
      data: {
        status: 'Paid',
        update_at: new Date(),
      },
    });

    // If this is a package invoice, add sessions to patient
    if (invoice.invoice_type && invoice.invoice_type !== 'Other') {
      const matchingPackage = await prisma.renamedpackage.findFirst({
        where: {
          package_name: invoice.invoice_type,
          status: 'Active',
          deleted_at: null,
        },
      });

      if (matchingPackage) {
        const currentSessions = patient.available_session || 0;
        const newSessions = currentSessions + (matchingPackage.avail_session || 0);

        // Update patient's available sessions
        await prisma.user_patients.update({
          where: {
            patient_id: patientIdValue,
          },
          data: {
            available_session: newSessions,
            update_at: new Date(),
          },
        });

        console.log(`Added ${matchingPackage.avail_session} sessions to patient ${patientIdValue}. New total: ${newSessions}`);
      }
    }

    return {
      statusCode: 201,
      message: "Payment submitted successfully",
      data: {
        payment_id: paymentData.payment_id,
        invoice_id: paymentData.invoice_id,
        patient_id: paymentData.patient_id,
        amount: paymentData.amount,
        method: paymentData.method,
        bank_name: paymentData.bank_name,
        reference_code: paymentData.reference_code,
        created_at: paymentData.created_at,
      },
    };

  } catch (error) {
    console.error("Error creating payment:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 