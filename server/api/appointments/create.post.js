import prisma from "~/server/utils/prisma";
import {
  findActivePractitioner,
  findLinkedActivePatient,
} from "~/server/utils/activeEntities";
import {
  computeEndTime,
  findOverlappingAppointment,
  parseAppointmentDate,
  persistAppointmentTimes,
  toDateOnlyString,
} from "~/server/utils/appointmentTime";
import { normalizeAppointmentStatus } from "~/utils/appointmentStatus";
import { takeSession } from "~/server/utils/sessionBalance";
import { isAdminRequest } from "~/server/utils/reports/guard";
import { withoutBillingFields } from "~/server/utils/billingFields";
import { linkCoveredAppointments } from "~/server/utils/coverage";

export default defineEventHandler(async (event) => {
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

      const patient = await findLinkedActivePatient(tx, patient_id, {
        patient_id: true,
        fullname: true,
        available_session: true,
      });

      if (!patient) {
        throw new Error(
          "Patient not found, inactive, or not linked to an active parent",
        );
      }

      if (!is_admin_appointment) {
        const practitioner = await findActivePractitioner(tx, practitioner_id, {
          practitioner_id: true,
        });

        if (!practitioner) {
          throw new Error("Practitioner not found or inactive");
        }
      }

      // A session is held while the appointment is not cancelled. With no prepaid session
      // left the booking still goes through (up to the admin-set cap of unbilled sessions)
      // and is marked as needing billing.
      const appointmentStatus = normalizeAppointmentStatus(parseInt(status, 10));
      let needsBilling = false;
      if (appointmentStatus !== 37) {
        // Only administrators may book on credit (up to the unbilled cap); everyone else
        // keeps the strict rule: a prepaid session is required.
        ({ needsBilling } = await takeSession(tx, patient.patient_id, {
          maxUnbilled: isAdminRequest(event) ? undefined : 0,
        }));
      }

      const created = await tx.appointments.create({
        data: {
          patient_id: parseInt(patient_id, 10),
          book_by: book_by ? parseInt(book_by, 10) : null,
          service_id: parseInt(service_id, 10),
          date: parseAppointmentDate(date),
          status: appointmentStatus,
          needs_billing: needsBilling,
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

      // Prepaid booking: remember which paid invoice the session came from.
      if (!needsBilling && appointmentStatus !== 37) {
        await linkCoveredAppointments(tx, patient.patient_id, [created.appointment_id]);
      }

      return tx.appointments.findUnique({
        where: { appointment_id: created.appointment_id },
      });
    });

    return {
      success: true,
      message: is_admin_appointment
        ? "Admin appointment created successfully! You can assign this to a doctor/therapist on the appointment date."
        : "Appointment created successfully",
      data: isAdminRequest(event) ? appointment : withoutBillingFields(appointment),
    };
  } catch (error) {
    console.error("Error creating appointment:", error);
    return {
      success: false,
      message: error.message || "Failed to create appointment",
    };
  }
});
