import { getParentAuthContext } from "~/server/utils/appsParentAuth";

export default defineEventHandler(async (event) => {
  try {
    const auth = await getParentAuthContext(event);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, message: auth.message };
    }

    const receipts = await prisma.payment.findMany({
      where: {
        deleted_at: null,
        status: "Approved",
        invoice: {
          status: "Paid",
          deleted_at: null,
          patient_id: { in: auth.patientIds.length ? auth.patientIds : [-1] },
        },
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
      orderBy: { created_at: "desc" },
    });

    return {
      statusCode: 200,
      message: "Receipts retrieved successfully",
      data: receipts,
    };
  } catch (error) {
    console.error("Error listing receipts:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
