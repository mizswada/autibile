import { getParentAuthContext } from "~/server/utils/appsParentAuth";

export default defineEventHandler(async (event) => {
  try {
    const auth = await getParentAuthContext(event);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, message: auth.message };
    }

    const invoiceId = parseInt(getRouterParam(event, "id"));
    if (isNaN(invoiceId) || invoiceId <= 0) {
      return { statusCode: 400, message: "Invalid invoice ID" };
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        invoice_id: invoiceId,
        deleted_at: null,
      },
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
          },
        },
        payment: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });

    if (!invoice) {
      return { statusCode: 404, message: "Invoice not found" };
    }

    if (!auth.patientIds.includes(invoice.patient_id)) {
      return { statusCode: 403, message: "Forbidden: Invoice does not belong to your child" };
    }

    const latestPayment = invoice.payment[0] || null;
    return {
      statusCode: 200,
      message: "Invoice retrieved successfully",
      data: {
        invoice_id: invoice.invoice_id,
        patient_id: invoice.patient_id,
        patient_name: invoice.user_patients?.fullname || "Unknown Patient",
        patient_nickname: invoice.user_patients?.nickname || null,
        invoice_type: invoice.invoice_type,
        description: invoice.description,
        amount: invoice.amount,
        date: invoice.date,
        status: invoice.status,
        latest_payment: latestPayment,
      },
    };
  } catch (error) {
    console.error("Error getting parent invoice:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
