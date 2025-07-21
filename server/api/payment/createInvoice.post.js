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
      patientID,
      patientName,
      invoiceType,
      description,
      amount,
      date,
      status,
    } = body;

    // Basic validation
    if (!patientID || !patientName || !invoiceType || !description || !amount || !date || !status) {
      return {
        statusCode: 400,
        message: "Missing required fields: patientID, patientName, invoiceType, description, amount, date, and status are required",
      };
    }

    // Validate patientID is a valid integer
    const patientIdValue = parseInt(patientID);
    if (isNaN(patientIdValue) || patientIdValue <= 0) {
      return {
        statusCode: 400,
        message: "Invalid patient ID",
      };
    }

    // Validate status
    if (!['Paid', 'Unpaid'].includes(status)) {
      return {
        statusCode: 400,
        message: "Invalid status. Must be either 'Paid' or 'Unpaid'",
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

    // Validate date format
    const invoiceDate = new Date(date);
    if (isNaN(invoiceDate.getTime())) {
      return {
        statusCode: 400,
        message: "Invalid date format",
      };
    }

    // Verify patient exists
    const patientExists = await prisma.user_patients.findFirst({
      where: {
        patient_id: patientIdValue,
        deleted_at: null,
      },
    });

    if (!patientExists) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    // Create invoice record linked to the patient
    const invoiceData = await prisma.invoice.create({
      data: {
        patient_id: patientIdValue,
        invoice_type: invoiceType,
        description: description,
        amount: amountValue,
        date: invoiceDate,
        status: status,
        created_at: new Date(),
        update_at: new Date(),
      },
    });

    if (!invoiceData) {
      return {
        statusCode: 500,
        message: "Failed to create invoice",
      };
    }

    return {
      statusCode: 201,
      message: "Invoice created successfully",
      data: {
        invoice_id: invoiceData.invoice_id,
        patient_id: invoiceData.patient_id,
        patient_name: patientName,
        invoice_type: invoiceData.invoice_type,
        description: invoiceData.description,
        amount: invoiceData.amount,
        date: invoiceData.date,
        status: invoiceData.status,
        created_at: invoiceData.created_at,
      },
    };

  } catch (error) {
    console.error("Error creating invoice:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 