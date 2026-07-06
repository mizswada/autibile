import { PrismaClient } from "@prisma/client";
import {
  getAvailableEndTimesForStart,
  getAvailableStartTimes,
  getPractitionerAppointmentsForDate,
  normalizeTimeString,
} from "~/server/utils/appointmentTime";

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const query = getQuery(event);
    const {
      date,
      practitioner_id,
      is_admin,
      duration_type,
      start_time,
      exclude_appointment_id,
    } = query;

    if (!date) {
      return {
        success: false,
        message: "Missing required field: date",
      };
    }

    const isAdminBooking = is_admin === "true" || is_admin === true;
    const normalizedStart = normalizeTimeString(start_time);

    let existingAppointments = [];
    if (!isAdminBooking && practitioner_id) {
      existingAppointments = await getPractitionerAppointmentsForDate(
        prisma,
        practitioner_id,
        date,
        exclude_appointment_id,
      );
    }

    if (duration_type === "custom" && normalizedStart) {
      const endSlots = getAvailableEndTimesForStart(
        normalizedStart,
        existingAppointments,
        { isAdminBooking },
      );

      return {
        success: true,
        slotType: "end",
        data: endSlots,
      };
    }

    const startSlots = getAvailableStartTimes(
      existingAppointments,
      duration_type || "30min",
      null,
      { isAdminBooking },
    );

    return {
      success: true,
      slotType: "start",
      data: startSlots,
    };
  } catch (error) {
    console.error("Error fetching available time slots:", error);
    return {
      success: false,
      message: "Failed to fetch available time slots",
      error: error.message,
    };
  }
});
