import { creditInvoiceSessions } from "~/server/utils/invoiceSessions";

export async function approvePaymentAndInvoice(paymentId, approvedByUserId) {
  const payment = await prisma.payment.findFirst({
    where: {
      payment_id: paymentId,
      deleted_at: null,
    },
    include: {
      invoice: true,
    },
  });

  if (!payment) {
    return { ok: false, statusCode: 404, message: "Payment not found" };
  }

  if (!payment.invoice) {
    return { ok: false, statusCode: 404, message: "Invoice not found for payment" };
  }

  if (payment.invoice.status === "Void" || payment.invoice.deleted_at) {
    return { ok: false, statusCode: 400, message: "This invoice is void, so its payment cannot be approved" };
  }

  if (payment.status === "Approved" && payment.invoice.status === "Paid") {
    return { ok: true, statusCode: 200, message: "Payment already approved", payment };
  }

  // Sessions are credited at most once per invoice (sessions_credited flag), so a
  // manual Paid toggle followed by an approval is never credited a second time here.
  const approvedAt = new Date();
  const updatedPayment = await prisma.$transaction(async (tx) => {
    const approved = await tx.payment.update({
      where: { payment_id: paymentId },
      data: {
        status: "Approved",
        approved_by: approvedByUserId,
        approved_at: approvedAt,
        rejection_reason: null,
        updated_at: approvedAt,
      },
    });

    await tx.invoice.update({
      where: { invoice_id: payment.invoice_id },
      data: {
        status: "Paid",
        update_at: approvedAt,
      },
    });

    await creditInvoiceSessions(payment.invoice_id, tx);

    return approved;
  });

  return { ok: true, statusCode: 200, message: "Payment approved successfully", payment: updatedPayment };
}

export async function rejectPayment(paymentId, approvedByUserId, reason = null) {
  const payment = await prisma.payment.findFirst({
    where: {
      payment_id: paymentId,
      deleted_at: null,
    },
    include: {
      invoice: true,
    },
  });

  if (!payment) {
    return { ok: false, statusCode: 404, message: "Payment not found" };
  }

  const rejectedAt = new Date();
  const updatedPayment = await prisma.payment.update({
    where: { payment_id: paymentId },
    data: {
      status: "Rejected",
      approved_by: approvedByUserId,
      approved_at: rejectedAt,
      rejection_reason: reason || null,
      updated_at: rejectedAt,
    },
  });

  // Only an Unpaid invoice goes back to Unpaid. A Paid or Void invoice keeps its status.
  if (payment.invoice && payment.invoice.status === "Unpaid") {
    await prisma.invoice.update({
      where: { invoice_id: payment.invoice_id },
      data: {
        status: "Unpaid",
        update_at: rejectedAt,
      },
    });
  }

  return { ok: true, statusCode: 200, message: "Payment rejected successfully", payment: updatedPayment };
}
