import prisma from "~/server/utils/prisma";
import { getAppAuth, practitionerOwns } from "~/server/utils/appsAuth";
import {
  formatAppointmentCalendarEvent,
  buildSessionNumberMap,
} from "~/server/utils/appointmentTime";

export default defineEventHandler(async (event) => {
  try {
    const auth = await getAppAuth(event, { role: "Any" });
    if (!auth.ok) {
      return { success: false, statusCode: auth.statusCode, message: auth.message };
    }

    const query = getQuery(event);
    const { date, patient_id, practitioner_id, status } = query;

    // A signed-in parent sees only their children's appointments, a practitioner only their own.
    if (auth.authenticated) {
      if (auth.patientIds) {
        const wanted = parseInt(patient_id, 10);
        if (!auth.patientIds.includes(wanted)) {
          return { success: false, statusCode: 403, message: "Forbidden: this child is not on your account" };
        }
      } else if (!practitionerOwns(auth, parseInt(practitioner_id, 10))) {
        return { success: false, statusCode: 403, message: "Forbidden: these are not your appointments" };
      }
    }

    const filter = {};
    if (date) filter.date = new Date(date);
    if (patient_id) filter.patient_id = parseInt(patient_id);
    if (practitioner_id) filter.practitioner_id = parseInt(practitioner_id);
    if (status) filter.status = parseInt(status);

    const appointments = await prisma.appointments.findMany({
      where: {
        ...filter,
        deleted_at: null,
      },
      include: {
        user_patients: true,
        user_practitioners: {
          include: { user: true },
        },
        service: true,
        lookup: true,
        user: true,
      },
      orderBy: { date: "asc" },
    });

    const sessionNumberMap = await buildSessionNumberMap(
      prisma,
      appointments.map((appointment) => appointment.patient_id),
    );

    const formattedAppointments = appointments.map((appointment) =>
      formatAppointmentCalendarEvent(
        appointment,
        sessionNumberMap[appointment.appointment_id] ?? null,
      ),
    );

    return { success: true, data: formattedAppointments };
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return {
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    };
  }
});
