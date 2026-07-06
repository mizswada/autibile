import { PrismaClient } from "@prisma/client";
import { formatAppointmentCalendarEvent } from "~/server/utils/appointmentTime";

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();

    const query = getQuery(event);
    const { date, patient_id, practitioner_id, status } = query;

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

    const patientAppointments = {};

    for (const appointment of appointments) {
      const patientId = appointment.patient_id;
      if (!patientAppointments[patientId]) {
        patientAppointments[patientId] = [];
      }
      patientAppointments[patientId].push(appointment);
    }

    for (const patientId in patientAppointments) {
      patientAppointments[patientId].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );

      patientAppointments[patientId].forEach((appointment, index) => {
        appointment.sessionNumber = index + 1;
      });
    }

    const formattedAppointments = appointments.map((appointment) =>
      formatAppointmentCalendarEvent(
        appointment,
        appointment.sessionNumber || 1,
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
