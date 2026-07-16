export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return { statusCode: 401, message: "Unauthorized: Missing user session" };
    }

    const payments = await prisma.payment.findMany({
      where: {
        status: "Pending",
        deleted_at: null,
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        invoice: {
          select: {
            invoice_id: true,
            description: true,
            amount: true,
            date: true,
            status: true,
          },
        },
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
            nickname: true,
          },
        },
      },
    });

    return {
      statusCode: 200,
      message: "Pending payments retrieved successfully",
      data: payments,
    };
  } catch (error) {
    console.error("Error listing pending payments:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
