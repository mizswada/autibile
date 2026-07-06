import { PrismaClient } from "@prisma/client";
import {
  computeEndTime,
  findOverlappingAppointment,
  parseAppointmentDate,
  persistAppointmentTimes,
  toDateOnlyString,
} from "~/server/utils/appointmentTime";

export default defineEventHandler(async (event) => {
  const prisma = new PrismaClient();

  try {
    const body = await readBody(event);

    const {
      patient_id,
      practitioner_id,
      book_by,
      service_id,
      date,
      start_time,
      duration_type,
      custom_end_time,
      status = 36,
      is_admin_appointment = false,
    } = body;

    if (!patient_id || !date || !service_id || !start_time || !duration_type) {
      return {
        success: false,
        message:
          "Missing required fields: patient, date, service, start time, and duration are required",
      };
    }

    if (!is_admin_appointment && !practitioner_id) {
      return {
        success: false,
        message: "Practitioner is required for non-admin appointments",
      };
    }

    let end_time;
    try {
      end_time = computeEndTime(start_time, duration_type, custom_end_time);
    } catch (error) {
      return { success: false, message: error.message };
    }

    const appointment = await prisma.$transaction(async (tx) => {
      if (!is_admin_appointment) {
        const overlap = await findOverlappingAppointment(tx, {
          practitionerId: practitioner_id,
          date: toDateOnlyString(date),
          startTime: start_time,
          endTime: end_time,
        });

        if (overlap) {
          throw new Error(
            "This time overlaps with an existing appointment for the selected practitioner",
          );
        }
      }

      const patient = await tx.user_patients.findUnique({
        where: {
          patient_id: parseInt(patient_id, 10),
          deleted_at: null,
        },
        select: {
          patient_id: true,
          fullname: true,
          available_session: true,
        },
      });

      if (!patient) {
        throw new Error("Patient not found");
      }

      const availableSessions = patient.available_session || 0;
      if (availableSessions <= 0) {
        throw new Error(
          `Cannot create appointment. Patient ${patient.fullname} has no available sessions (${availableSessions}). Please purchase more sessions first.`,
        );
      }

      await tx.user_patients.update({
        where: {
          patient_id: patient.patient_id,
        },
        data: {
          available_session: availableSessions - 1,
          update_at: new Date(),
        },
      });

      const created = await tx.appointments.create({
        data: {
          patient_id: parseInt(patient_id, 10),
          book_by: book_by ? parseInt(book_by, 10) : null,
          service_id: parseInt(service_id, 10),
          date: parseAppointmentDate(date),
          status: parseInt(status, 10),
          practitioner_id: is_admin_appointment
            ? null
            : parseInt(practitioner_id, 10),
          slot_ID: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await persistAppointmentTimes(
        tx,
        created.appointment_id,
        start_time,
        end_time,
      );

      return tx.appointments.findUnique({
        where: { appointment_id: created.appointment_id },
      });
    });

    return {
      success: true,
      message: is_admin_appointment
        ? "Admin appointment created successfully! You can assign this to a doctor/therapist on the appointment date."
        : "Appointment created successfully",
      data: appointment,
    };
  } catch (error) {
    console.error("Error creating appointment:", error);
    return {
      success: false,
      message: error.message || "Failed to create appointment",
    };
  }
});
