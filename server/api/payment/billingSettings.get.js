import { requireAdmin } from "~/server/utils/reports/guard";
import { getMaxUnbilled, MAX_UNBILLED_LIMIT } from "~/server/utils/sessionBalance";

/** Billing settings (admin only): how many unbilled sessions one patient may owe. */
export default defineEventHandler(async (event) => {
  try {
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    return {
      statusCode: 200,
      message: "Success",
      data: { maxUnbilled: await getMaxUnbilled(), maxAllowed: MAX_UNBILLED_LIMIT },
    };
  } catch (error) {
    console.error("billingSettings get error:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
