import { requireAdmin } from "~/server/utils/reports/guard";
import { MAX_UNBILLED_LIMIT, MAX_UNBILLED_SETTING_KEY } from "~/server/utils/sessionBalance";

/** Change the unbilled-session cap (admin only). 0 means booking needs a prepaid session, as before. */
export default defineEventHandler(async (event) => {
  try {
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    const body = (await readBody(event)) || {};
    const maxUnbilled = Number(body.maxUnbilled);
    if (!Number.isInteger(maxUnbilled) || maxUnbilled < 0 || maxUnbilled > MAX_UNBILLED_LIMIT) {
      return {
        statusCode: 400,
        message: `Enter a whole number from 0 to ${MAX_UNBILLED_LIMIT}.`,
      };
    }

    await prisma.app_settings.upsert({
      where: { setting_key: MAX_UNBILLED_SETTING_KEY },
      create: {
        setting_key: MAX_UNBILLED_SETTING_KEY,
        setting_value: String(maxUnbilled),
        created_at: new Date(),
      },
      update: {
        setting_value: String(maxUnbilled),
        updated_at: new Date(),
      },
    });

    return { statusCode: 200, message: "Saved.", data: { maxUnbilled } };
  } catch (error) {
    console.error("billingSettings put error:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
