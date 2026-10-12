import { approvePaymentAndInvoice } from "~/server/utils/paymentApproval";
import { requireAdmin } from "~/server/utils/reports/guard";

export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return { statusCode: 401, message: "Unauthorized: Missing user session" };
    }

    // Money actions are for administrators only (not for doctors / therapists).
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    const body = await readBody(event);
    const paymentId = parseInt(body?.paymentID);

    if (isNaN(paymentId) || paymentId <= 0) {
      return { statusCode: 400, message: "Invalid payment ID" };
    }

    const result = await approvePaymentAndInvoice(paymentId, userID);
    return { statusCode: result.statusCode, message: result.message, data: result.payment || null };
  } catch (error) {
    console.error("Error approving payment:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
