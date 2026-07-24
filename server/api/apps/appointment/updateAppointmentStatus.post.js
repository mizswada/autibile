import { PrismaClient } from "@prisma/client";

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const body = await readBody(event);
    const { appointment_id, status } = body;

    if (!appointment_id) {
      return {
        success: false,
        message: "Missing required field: appointment_id",
      };
    }

    if (status === undefined || status === null) {
      return {
        success: false,
        message: "Missing required field: status",
      };
    }

    const parsedStatus = parseInt(status, 10);
    if (Number.isNaN(parsedStatus)) {
      return {
        success: false,
        message: "Invalid status value",
      };
    }

    const existingAppointment = await prisma.appointments.findUnique({
      where: {
        appointment_id: parseInt(appointment_id, 10),
      },
    });

    if (!existingAppointment) {
      return {
        success: false,
        message: "Appointment not found",
      };
    }

    const existingStatus = existingAppointment.status;
    const patientId = existingAppointment.patient_id;

    const wasReserved = existingStatus !== 37;
    const willBeReserved = parsedStatus !== 37;
    const releaseSession = wasReserved && !willBeReserved;
    const acquireSession = !wasReserved && willBeReserved;

    const updatedAppointment = await prisma.$transaction(async (tx) => {
      if (acquireSession && patientId != null) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: patientId },
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
            `Cannot update appointment. Patient ${patient.fullname} has no available sessions (${availableSessions}).`,
          );
        }

        await tx.user_patients.update({
          where: { patient_id: patientId },
          data: {
            available_session: availableSessions - 1,
            update_at: new Date(),
          },
        });
      }

      if (releaseSession && patientId != null) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: patientId },
          select: { patient_id: true, available_session: true },
        });

        if (patient) {
          await tx.user_patients.update({
            where: { patient_id: patientId },
            data: {
              available_session: (patient.available_session || 0) + 1,
              update_at: new Date(),
            },
          });
        }
      }

      return tx.appointments.update({
        where: {
          appointment_id: parseInt(appointment_id, 10),
        },
        data: {
          status: parsedStatus,
          updated_at: new Date(),
        },
      });
    });

    return {
      success: true,
      message: "Appointment status updated successfully",
      data: {
        appointment_id: updatedAppointment.appointment_id,
        status: updatedAppointment.status,
        updated_at: updatedAppointment.updated_at,
      },
    };
  } catch (error) {
    console.error("Error updating appointment status:", error);
    return {
      success: false,
      message: error.message || "Failed to update appointment status",
      error: error.message,
    };
  }
});
