import { PrismaClient } from "@prisma/client";
import {
  attachAppointmentTimes,
  computeEndTime,
  findOverlappingAppointment,
  getAppointmentTimes,
  parseAppointmentDate,
  persistAppointmentTimes,
  toDateOnlyString,
} from "~/server/utils/appointmentTime";

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const body = await readBody(event);

    const {
      appointment_id,
      patient_id,
      practitioner_id,
      service_id,
      date,
      start_time,
      duration_type,
      custom_end_time,
      status,
      parent_rate,
      parent_comment,
      therapist_doctor_comment,
      is_admin_appointment,
    } = body;

    if (!appointment_id) {
      return {
        success: false,
        message: "Missing required field: appointment_id",
      };
    }

    const existingAppointment = await prisma.appointments.findUnique({
      where: {
        appointment_id: parseInt(appointment_id),
      },
      include: {
        lookup: true,
      },
    });

    if (!existingAppointment) {
      return {
        success: false,
        message: "Appointment not found",
      };
    }

    await attachAppointmentTimes(prisma, existingAppointment);

    const updateData = {
      updated_at: new Date(),
    };

    if (patient_id) updateData.patient_id = parseInt(patient_id);
    if (service_id) updateData.service_id = parseInt(service_id);
    if (date) updateData.date = parseAppointmentDate(date);
    if (status !== undefined) updateData.status = parseInt(status);
    if (parent_rate) updateData.parent_rate = parseFloat(parent_rate);
    if (parent_comment !== undefined) updateData.parent_comment = parent_comment;
    if (therapist_doctor_comment !== undefined) {
      updateData.therapist_doctor_comment = therapist_doctor_comment;
    }

    const willBeAdmin =
      is_admin_appointment === true ||
      (is_admin_appointment !== false &&
        existingAppointment.practitioner_id === null &&
        (practitioner_id === null || practitioner_id === undefined));

    if (is_admin_appointment === true) {
      updateData.practitioner_id = null;
      updateData.slot_ID = null;
    } else if (is_admin_appointment === false) {
      if (!practitioner_id) {
        return {
          success: false,
          message:
            "Practitioner ID is required when converting admin appointment to regular appointment",
        };
      }
      updateData.practitioner_id = parseInt(practitioner_id);
      updateData.slot_ID = null;
    } else if (practitioner_id !== undefined) {
      updateData.practitioner_id = practitioner_id
        ? parseInt(practitioner_id)
        : null;
    }

    let pendingStartTime = null;
    let pendingEndTime = null;

    if (start_time && duration_type) {
      let end_time;
      try {
        end_time = computeEndTime(start_time, duration_type, custom_end_time);
      } catch (error) {
        return { success: false, message: error.message };
      }

      pendingStartTime = start_time;
      pendingEndTime = end_time;
      updateData.slot_ID = null;
    }

    const effectivePractitionerId =
      updateData.practitioner_id !== undefined
        ? updateData.practitioner_id
        : existingAppointment.practitioner_id;

    const effectiveDate = updateData.date || existingAppointment.date;

    if (!willBeAdmin && effectivePractitionerId) {
      const overlapStartTime =
        pendingStartTime ||
        getAppointmentTimes(existingAppointment).start_time;
      const overlapEndTime =
        pendingEndTime || getAppointmentTimes(existingAppointment).end_time;

      if (overlapStartTime && overlapEndTime) {
        const overlap = await findOverlappingAppointment(prisma, {
          practitionerId: effectivePractitionerId,
          date: toDateOnlyString(effectiveDate),
          startTime: overlapStartTime,
          endTime: overlapEndTime,
          excludeAppointmentId: appointment_id,
        });

        if (overlap) {
          return {
            success: false,
            message:
              "This time overlaps with an existing appointment for the selected practitioner",
          };
        }
      }
    }

    // Session balance transitions (a session is "held" while status !== 37).
    const existingStatus = existingAppointment.status;
    const newStatus =
      updateData.status !== undefined ? updateData.status : existingStatus;
    const existingPatientId = existingAppointment.patient_id;
    const newPatientId =
      updateData.patient_id !== undefined
        ? updateData.patient_id
        : existingPatientId;

    const wasReserved = existingStatus !== 37;
    const willBeReserved = newStatus !== 37;
    const patientChanged = newPatientId !== existingPatientId;

    const releaseOld = wasReserved && (!willBeReserved || patientChanged);
    const acquireNew = willBeReserved && (!wasReserved || patientChanged);

    const appointmentResult = await prisma.$transaction(async (tx) => {
      if (acquireNew) {
        const targetPatient = await tx.user_patients.findUnique({
          where: { patient_id: newPatientId },
          select: {
            patient_id: true,
            fullname: true,
            available_session: true,
          },
        });

        if (!targetPatient) {
          throw new Error("Patient not found");
        }

        const availableSessions = targetPatient.available_session || 0;
        if (availableSessions <= 0) {
          throw new Error(
            `Cannot update appointment. Patient ${targetPatient.fullname} has no available sessions (${availableSessions}). Please purchase more sessions first.`,
          );
        }

        await tx.user_patients.update({
          where: { patient_id: newPatientId },
          data: {
            available_session: availableSessions - 1,
            update_at: new Date(),
          },
        });
      }

      if (releaseOld && existingPatientId != null) {
        const oldPatient = await tx.user_patients.findUnique({
          where: { patient_id: existingPatientId },
          select: { patient_id: true, available_session: true },
        });

        if (oldPatient) {
          await tx.user_patients.update({
            where: { patient_id: existingPatientId },
            data: {
              available_session: (oldPatient.available_session || 0) + 1,
              update_at: new Date(),
            },
          });
        }
      }

      const updated = await tx.appointments.update({
        where: { appointment_id: parseInt(appointment_id) },
        data: updateData,
      });

      if (pendingStartTime && pendingEndTime) {
        await persistAppointmentTimes(
          tx,
          appointment_id,
          pendingStartTime,
          pendingEndTime,
        );

        return tx.appointments.findUnique({
          where: { appointment_id: parseInt(appointment_id, 10) },
        });
      }

      return updated;
    });

    return {
      success: true,
      message: "Appointment updated successfully",
      data: appointmentResult,
    };
  } catch (error) {
    console.error("Error updating appointment:", error);
    return {
      success: false,
      message: error.message || "Failed to update appointment",
      error: error.message,
    };
  }
});
