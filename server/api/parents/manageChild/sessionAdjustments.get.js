import { requireAdmin } from "~/server/utils/reports/guard";

/** History of manual session adjustments for one patient (admin only). */
export default defineEventHandler(async (event) => {
  try {
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

    const patientId = parseInt(getQuery(event).patientId, 10);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      return { statusCode: 400, message: "A valid patient is required." };
    }

    const rows = await prisma.session_adjustment.findMany({
      where: { patient_id: patientId },
      orderBy: { adjustment_id: "desc" },
      take: 100,
    });

    return {
      statusCode: 200,
      message: "Success",
      data: rows.map((row) => ({
        adjustment_id: row.adjustment_id,
        delta: row.delta,
        balance_before: row.balance_before,
        balance_after: row.balance_after,
        reason: row.reason,
        admin_email: row.admin_email,
        created_at: row.created_at,
      })),
    };
  } catch (error) {
    console.error("sessionAdjustments error:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
