export async function creditPackageSessions(invoice, patientId) {
  if (!invoice?.invoice_type || invoice.invoice_type === "Other") {
    return;
  }

  const matchingPackage = await prisma.renamedpackage.findFirst({
    where: {
      package_name: invoice.invoice_type,
      status: "Active",
      deleted_at: null,
    },
  });

  if (!matchingPackage) {
    return;
  }

  const patient = await prisma.user_patients.findFirst({
    where: {
      patient_id: patientId,
      deleted_at: null,
    },
    select: {
      available_session: true,
    },
  });

  if (!patient) {
    return;
  }

  const currentSessions = patient.available_session || 0;
  const newSessions = currentSessions + (matchingPackage.avail_session || 0);

  await prisma.user_patients.update({
    where: {
      patient_id: patientId,
    },
    data: {
      available_session: newSessions,
      update_at: new Date(),
    },
  });
}

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

  if (payment.status === "Approved" && payment.invoice.status === "Paid") {
    return { ok: true, statusCode: 200, message: "Payment already approved", payment };
  }

  const approvedAt = new Date();
  const updatedPayment = await prisma.payment.update({
    where: { payment_id: paymentId },
    data: {
      status: "Approved",
      approved_by: approvedByUserId,
      approved_at: approvedAt,
      rejection_reason: null,
      updated_at: approvedAt,
    },
  });

  await prisma.invoice.update({
    where: { invoice_id: payment.invoice_id },
    data: {
      status: "Paid",
      update_at: approvedAt,
    },
  });

  await creditPackageSessions(payment.invoice, payment.patient_id);

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

  if (payment.invoice && payment.invoice.status !== "Paid") {
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
