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
    const {
      date,
      patient_id,
      practitioner_id,
      status,
      is_admin,
      start_date,
      end_date,
      appointment_id,
    } = query;

    const filter = {};
    if (date) filter.date = new Date(date);
    if (start_date) filter.date = { gte: new Date(start_date) };
    if (end_date) filter.date = { ...filter.date, lte: new Date(end_date) };
    if (patient_id) filter.patient_id = parseInt(patient_id);
    if (practitioner_id) filter.practitioner_id = parseInt(practitioner_id);
    if (status) filter.status = parseInt(status);
    if (appointment_id) filter.appointment_id = parseInt(appointment_id);

    if (is_admin !== undefined) {
      if (is_admin === "true" || is_admin === true) {
        filter.practitioner_id = null;
      } else {
        filter.practitioner_id = { not: null };
      }
    }

    // Doctors may only see their own appointments (not other doctors / admin).
    // Enforce on the server so query params cannot bypass this.
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
    console.error("Error fetching appointments:", error);
    return {
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    };
  }
});
