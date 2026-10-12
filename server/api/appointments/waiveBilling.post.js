import prisma from "~/server/utils/prisma";
import { getVerifiedAdmin } from "~/server/utils/adminSession";
import { adjustBalance } from "~/server/utils/sessionBalance";

function clientIp(event) {
  const forwarded = event.node.req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return event.node.req.socket?.remoteAddress || null;
}

/**
 * Waive (or un-waive) billing for appointments (admin only).
 *
 * Waiving means the clinic decides not to charge for the session. It leaves the "To Bill"
 * list AND gives the session back (+1), so the patient no longer owes it and it stops
 * counting against the unbilled limit. Un-waiving takes the session again (-1).
 * Both are written to the session adjustment log with the reason.
 */
export default defineEventHandler(async (event) => {
  try {
    const session = await getVerifiedAdmin(event);
    if (!session.ok) {
      return { success: false, statusCode: session.statusCode, message: session.message };
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
    if (reason.length > 400) {
      return { success: false, message: "The reason is too long (400 characters at most)." };
    }

    const eligibleWhere = waived
      ? {
          appointment_id: { in: ids },
          deleted_at: null,
          needs_billing: true,
          billing_waived: false,
          invoice_id: null,
          status: { not: 37 },
        }
      : { appointment_id: { in: ids }, deleted_at: null, billing_waived: true };

    const count = await prisma.$transaction(async (tx) => {
      const rows = await tx.appointments.findMany({
        where: eligibleWhere,
        select: { appointment_id: true, patient_id: true },
      });
      if (rows.length !== ids.length) {
        const conflict = new Error(
          waived
            ? "Some appointments can no longer be waived (already billed, cancelled or not unbilled)."
            : "Some appointments were not waived.",
        );
        conflict.code = "BILLING_CONFLICT";
        throw conflict;
      }

      const changed = await tx.appointments.updateMany({
        where: eligibleWhere,
        data: { billing_waived: waived, updated_at: new Date() },
      });
      if (changed.count !== ids.length) {
        const conflict = new Error("These appointments changed while saving. Refresh and try again.");
        conflict.code = "BILLING_CONFLICT";
        throw conflict;
      }

      // One logged adjustment per patient: +1 for every waived appointment, -1 when restored.
      const perPatient = new Map();
      for (const row of rows) {
        if (row.patient_id == null) continue;
        const entry = perPatient.get(row.patient_id) || [];
        entry.push(row.appointment_id);
        perPatient.set(row.patient_id, entry);
      }
      for (const [patientId, appointmentIds] of perPatient) {
        const label = appointmentIds.map((id) => `#${id}`).join(", ");
        await adjustBalance(tx, patientId, waived ? appointmentIds.length : -appointmentIds.length, {
          reason: waived
            ? `Billing waived for appointment ${label}: ${reason}`
            : `Billing restored for appointment ${label}${reason ? `: ${reason}` : ""}`,
          admin: session.admin,
          ip: clientIp(event),
        });
      }

      return changed.count;
    });

    return {
      success: true,
      message: waived ? "Billing waived. The session was given back." : "Billing restored.",
      data: { count },
    };
  } catch (error) {
    if (error?.code === "BILLING_CONFLICT") {
      return { success: false, message: error.message };
    }
    console.error("Error waiving billing:", error);
    return { success: false, message: "Failed to update billing" };
  }
});
