import { getVerifiedAdmin } from "~/server/utils/adminSession";
import { adjustBalance } from "~/server/utils/sessionBalance";

function clientIp(event) {
  const forwarded = event.node.req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return event.node.req.socket?.remoteAddress || null;
}

/**
 * Manual, logged correction of a patient's session balance (admin only).
 * The balance is no longer editable as a plain number; this is the only way to change it by hand.
 */
export default defineEventHandler(async (event) => {
  try {
    const session = await getVerifiedAdmin(event);
    if (!session.ok) {
      return { statusCode: session.statusCode, message: session.message };
    }

    const body = (await readBody(event)) || {};
    const patientId = parseInt(body.patientId, 10);
    const delta = parseInt(body.delta, 10);
    const reason = String(body.reason || "").trim();

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return { statusCode: 400, message: "A valid patient is required." };
    }
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) {
      return { statusCode: 400, message: "Enter a number of sessions between 1 and 100 (positive to add, negative to remove)." };
    }
    if (reason.length < 3) {
      return { statusCode: 400, message: "A reason is required (at least 3 characters)." };
    }
    if (reason.length > 500) {
      return { statusCode: 400, message: "The reason is too long (500 characters at most)." };
    }

    const patient = await prisma.user_patients.findFirst({
      where: { patient_id: patientId, deleted_at: null },
      select: { patient_id: true },
    });
    if (!patient) {
      return { statusCode: 404, message: "Patient not found." };
    }

    const result = await prisma.$transaction((tx) =>
      adjustBalance(tx, patientId, delta, {
        reason,
        admin: session.admin,
        ip: clientIp(event),
      }),
    );

    return {
      statusCode: 200,
      message: "Sessions adjusted.",
      data: {
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        availableSessions: Math.max(0, result.balanceAfter),
        owedSessions: Math.max(0, -result.balanceAfter),
      },
    };
  } catch (error) {
    console.error("adjustSessions error:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
