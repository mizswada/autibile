import { findLinkedActivePatient } from "~/server/utils/activeEntities";
import { approvePaymentAndInvoice } from "~/server/utils/paymentApproval";
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

    const {
      invoiceID,
      patientID,
      amount,
      method,
      bank_name,
      reference_code,
    } = body;

    const isCash = method === 'Cash';

    // Basic validation
    if (!invoiceID || !patientID || !amount || !method) {
      return {
        statusCode: 400,
        message: "Missing required fields: invoiceID, patientID, amount, and method are required",
      };
    }

    if (!isCash && (!bank_name || !reference_code)) {
      return {
        statusCode: 400,
        message: "Missing required fields: bank_name and reference_code are required for this payment method",
      };
    }

    // Validate method
    if (!['Online Banking', 'Credit Card', 'E-Wallet', 'Cash'].includes(method)) {
      return {
        statusCode: 400,
        message: "Invalid payment method. Must be 'Online Banking', 'Credit Card', 'E-Wallet', or 'Cash'",
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

    if (invoice.status === 'Void') {
      return {
        statusCode: 400,
        message: "This invoice is void and cannot be paid",
      };
    }

    if (invoice.patient_id !== patientIdValue) {
      return {
        statusCode: 400,
        message: "This invoice belongs to a different patient",
      };
    }

    // A payment must be for the full invoice amount (partial payments are not supported;
    // approving one would still mark the invoice Paid and add the sessions).
    if (Math.abs(Number(invoice.amount || 0) - amountValue) > 0.005) {
      return {
        statusCode: 400,
        message: `The payment (RM ${amountValue.toFixed(2)}) must match the invoice amount (RM ${Number(invoice.amount || 0).toFixed(2)})`,
      };
    }

    // Verify patient exists, is active, and linked to an active parent
    const patient = await findLinkedActivePatient(prisma, patientIdValue);

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found, inactive, or not linked to an active parent",
      };
    }

    const pendingPayment = await prisma.payment.findFirst({
      where: {
        invoice_id: invoiceIdValue,
        status: "Pending",
        deleted_at: null,
      },
    });

    if (pendingPayment) {
      return {
        statusCode: 400,
        message: "This invoice has a pending payment awaiting approval",
      };
    }

    // Create admin payment record
    const paymentData = await prisma.payment.create({
      data: {
        patient_id: patientIdValue,
        invoice_id: invoiceIdValue,
        amount: amountValue,
        method: method,
        bank_name: isCash ? null : bank_name,
        reference_code: isCash ? null : reference_code,
        status: "Approved",
        submitted_by: "admin",
        approved_by: userID,
        approved_at: new Date(),
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

    const approvalResult = await approvePaymentAndInvoice(paymentData.payment_id, userID);
    if (!approvalResult.ok) {
      // Do not leave a stray "Approved" payment behind when the approval was refused.
      await prisma.payment.update({
        where: { payment_id: paymentData.payment_id },
        data: {
          status: "Rejected",
          rejection_reason: approvalResult.message,
          updated_at: new Date(),
        },
      });
      return {
        statusCode: approvalResult.statusCode,
        message: approvalResult.message,
      };
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