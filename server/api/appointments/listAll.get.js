import { PrismaClient } from "@prisma/client";
import {
  formatAppointmentCalendarEvent,
  buildSessionNumberMap,
} from "~/server/utils/appointmentTime";

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();

    const { userID, roles } = event.context.user || {};
    if (!userID) {
      return {
        success: false,
        message: "Unauthorized: Missing user session",
      };
    }

    const isAdmin = roles?.some(
      (role) => role.includes("Admin") || role.includes("Administrator"),
    );
    const isDoctor = roles?.some(
      (role) => role.includes("Practitioners") || role.includes("Doctor"),
    );

    const query = getQuery(event);
    const { date, patient_id, practitioner_id, status } = query;

    const filter = {};
    if (date) filter.date = new Date(date);
    if (patient_id) filter.patient_id = parseInt(patient_id);
    if (practitioner_id) filter.practitioner_id = parseInt(practitioner_id);
    if (status) filter.status = parseInt(status);

    // Doctors may only see their own appointments.
    if (isDoctor && !isAdmin) {
      const doctor = await prisma.user_practitioners.findFirst({
        where: {
          user_id: parseInt(userID),
          type: "Doctor",
          status: "Active",
        },
      });

      if (!doctor) {
        return { success: true, data: [] };
      }

      filter.practitioner_id = doctor.practitioner_id;
    }

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
    console.error("Error fetching all appointments:", error);
    return {
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    };
  }
});
