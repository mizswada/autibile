import prisma from "~/server/utils/prisma";
import { requireAdmin } from "~/server/utils/reports/guard";

/**
 * Waive (or un-waive) billing for appointments (admin only).
 * A waived appointment leaves the "To Bill" list without being charged.
 */
export default defineEventHandler(async (event) => {
  try {
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { success: false, statusCode: guard.statusCode, message: guard.message };
    }

    const body = (await readBody(event)) || {};
    const ids = [
      ...new Set(
        (Array.isArray(body.appointmentIds) ? body.appointmentIds : [])
          .map((id) => parseInt(id, 10))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    const waived = body.waived !== false;
    const reason = String(body.reason || "").trim();

    if (!ids.length) {
      return { success: false, message: "Select at least one appointment." };
    }
    if (waived && reason.length < 3) {
      return { success: false, message: "A reason is required to waive billing." };
    }

    const result = await prisma.appointments.updateMany({
      where: waived
        ? {
            appointment_id: { in: ids },
            deleted_at: null,
            needs_billing: true,
            invoice_id: null,
            status: { not: 37 },
          }
        : { appointment_id: { in: ids }, deleted_at: null, billing_waived: true },
      data: { billing_waived: waived, updated_at: new Date() },
    });

    if (result.count !== ids.length) {
      return {
        success: false,
        message: waived
          ? "Some appointments can no longer be waived (already billed, cancelled or not unbilled)."
          : "Some appointments were not waived.",
      };
    }

    console.log(
      `[billing] ${waived ? "waived" : "un-waived"} appointments ${ids.join(",")}${waived ? ` (${reason})` : ""}`,
    );

    return {
      success: true,
      message: waived ? "Billing waived." : "Billing restored.",
      data: { count: result.count },
    };
  } catch (error) {
    console.error("Error waiving billing:", error);
    return { success: false, message: "Failed to update billing" };
  }
});
