import { getParentAuthContext } from "~/server/utils/appsParentAuth";

export default defineEventHandler(async (event) => {
  try {
    const auth = await getParentAuthContext(event);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, message: auth.message };
    }

    const paymentId = parseInt(getRouterParam(event, "id"));
    if (isNaN(paymentId) || paymentId <= 0) {
      return { statusCode: 400, message: "Invalid payment ID" };
    }

    const payment = await prisma.payment.findFirst({
      where: {
        payment_id: paymentId,
        status: "Approved",
        deleted_at: null,
      },
      include: {
        invoice: true,
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
          },
        },
      },
    });

    if (!payment) {
      return { statusCode: 404, message: "Receipt not found" };
    }

    if (!auth.patientIds.includes(payment.patient_id)) {
      return { statusCode: 403, message: "Forbidden: Receipt does not belong to your child" };
    }

    return {
      statusCode: 200,
      message: "Receipt retrieved successfully",
      data: payment,
    };
  } catch (error) {
    console.error("Error getting receipt:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
