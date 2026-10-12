import prisma from "~/server/utils/prisma";
import { requireAdmin } from "~/server/utils/reports/guard";
import { formatAppointmentCalendarEvent } from "~/server/utils/appointmentTime";
import { unbilledAppointmentsListWhere } from "~/server/utils/billingWhere";
import { reconcileAllUnbilled } from "~/server/utils/sessionBalance";

/**
 * Appointments booked without a prepaid session that no invoice bills yet (admin only).
 *
 *   ?patient_id=12  -> flat list for that patient (used by the invoice form)
 *   (no patient_id) -> the "To Bill" list, grouped by patient
 */
export default defineEventHandler(async (event) => {
  try {
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { success: false, statusCode: guard.statusCode, message: guard.message };
    }

    const patientId = parseInt(getQuery(event).patient_id, 10);
    const hasPatient = Number.isInteger(patientId) && patientId > 0;

    // Self-healing: drop markers the balance already covers (hand edits, old races).
    await reconcileAllUnbilled(prisma);

    const appointments = await prisma.appointments.findMany({
      where: unbilledAppointmentsListWhere(hasPatient ? { patient_id: patientId } : {}),
      include: {
        user_patients: true,
        user_practitioners: { include: { user: true } },
        service: true,
        lookup: true,
        user: true,
      },
      orderBy: [{ date: "asc" }, { appointment_id: "asc" }],
    });

    const rows = appointments.map((appointment) => {
      const event = formatAppointmentCalendarEvent(appointment, null);
      return {
        appointment_id: appointment.appointment_id,
        patient_id: appointment.patient_id,
        patient_name: event.extendedProps.patient_name || "Unknown Patient",
        date: appointment.date.toISOString().split("T")[0],
        time_slot: event.extendedProps.time_slot,
        service_name: event.extendedProps.service_name || "Unknown Service",
        status: appointment.status,
        patient_inactive: String(appointment.user_patients?.status || '').toLowerCase() !== 'active',
      };
    });

    if (hasPatient) {
      return { success: true, data: rows };
    }

    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.patient_id)) {
        groups.set(row.patient_id, {
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          count: 0,
          patient_inactive: row.patient_inactive,
          appointments: [],
        });
      }
      const group = groups.get(row.patient_id);
      group.count += 1;
      group.appointments.push(row);
    }

    return { success: true, data: [...groups.values()] };
  } catch (error) {
    console.error("Error fetching unbilled appointments:", error);
    return { success: false, message: "Failed to fetch unbilled appointments" };
  }
});
