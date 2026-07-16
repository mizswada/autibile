import { getParentAuthContext } from "~/server/utils/appsParentAuth";

export default defineEventHandler(async (event) => {
  try {
    const auth = await getParentAuthContext(event);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, message: auth.message };
    }

    const body = await readBody(event);
    const invoiceID = parseInt(body?.invoiceID);
    const amount = parseFloat(body?.amount);
    const method = body?.method;
    const bankName = body?.bank_name || null;
    const referenceCode = body?.reference_code || null;
    const isCash = method === "Cash";

    if (isNaN(invoiceID) || invoiceID <= 0 || !method || isNaN(amount) || amount <= 0) {
      return { statusCode: 400, message: "Invalid payment submission data" };
    }

    if (!["Online Banking", "Credit Card", "E-Wallet", "Cash"].includes(method)) {
      return { statusCode: 400, message: "Invalid payment method" };
    }

    if (!isCash && (!bankName || !referenceCode)) {
      return { statusCode: 400, message: "Bank name and reference code are required" };
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        invoice_id: invoiceID,
        deleted_at: null,
      },
    });

    if (!invoice) {
      return { statusCode: 404, message: "Invoice not found" };
    }

    if (!auth.patientIds.includes(invoice.patient_id)) {
      return { statusCode: 403, message: "Forbidden: Invoice does not belong to your child" };
    }

    if (invoice.status === "Paid") {
      return { statusCode: 400, message: "Invoice is already paid" };
    }

    const existingPending = await prisma.payment.findFirst({
      where: {
        invoice_id: invoiceID,
        status: "Pending",
        deleted_at: null,
      },
    });

    if (existingPending) {
      return { statusCode: 400, message: "A payment is already pending approval for this invoice" };
    }

    const payment = await prisma.payment.create({
      data: {
        patient_id: invoice.patient_id,
        invoice_id: invoiceID,
        amount,
        method,
        bank_name: isCash ? null : bankName,
        reference_code: isCash ? null : referenceCode,
        status: "Pending",
        submitted_by: "parent",
        parent_id: auth.parentId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      statusCode: 201,
      message: "Payment submitted and pending admin approval",
      data: payment,
    };
  } catch (error) {
    console.error("Error submitting parent payment:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
