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

  // The invoice is already settled (for example marked Paid by hand): approving another
  // payment would record the money twice. Reject it instead.
  if (payment.invoice.status === "Paid") {
    return {
      ok: false,
      statusCode: 400,
      message: "This invoice is already paid, so this payment cannot be approved. Reject it instead.",
    };
  }

  // Sessions are credited at most once per invoice (sessions_credited flag), so a
  // manual Paid toggle followed by an approval is never credited a second time here.
  const approvedAt = new Date();
  let updatedPayment;
  try {
    updatedPayment = await prisma.$transaction(async (tx) => {
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

      // Atomic claim: only an Unpaid invoice can become Paid, so two payments approved at
      // the same time (double click, two admins) can never both settle the same invoice.
      const claim = await tx.invoice.updateMany({
        where: { invoice_id: payment.invoice_id, status: "Unpaid", deleted_at: null },
        data: {
          status: "Paid",
          update_at: approvedAt,
        },
      });
      if (claim.count === 0) {
        throw new Error("INVOICE_NOT_UNPAID");
      }

      const credit = await creditInvoiceSessions(payment.invoice_id, tx);
      if (credit.reason === "patient_inactive") {
        // The sessions cannot be added, so nothing is approved (rolls everything back).
        throw new Error("PATIENT_INACTIVE");
      }

      return approved;
    });
  } catch (error) {
    if (error?.message === "INVOICE_NOT_UNPAID") {
      return {
        ok: false,
        statusCode: 400,
        message: "This invoice is no longer unpaid (already paid or void), so this payment cannot be approved.",
      };
    }
    if (error?.message === "PATIENT_INACTIVE") {
      return {
        ok: false,
        statusCode: 400,
        message: "The patient is inactive or deleted, so the sessions cannot be added. Reactivate the patient first.",
      };
    }
    throw error;
  }

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

  // Only a payment that is still waiting can be rejected. Rejecting an approved one would
  // leave a Paid invoice (with its sessions) and no approved payment behind.
  if (payment.status !== "Pending") {
    return {
      ok: false,
      statusCode: 400,
      message: `This payment is already ${String(payment.status || "").toLowerCase()} and cannot be rejected.`,
    };
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
