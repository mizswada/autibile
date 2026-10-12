import prisma from "~/server/utils/prisma";
import { normalizeAppointmentStatus } from "~/utils/appointmentStatus";
import { releaseSession as giveSessionBack, takeSession } from "~/server/utils/sessionBalance";

export default defineEventHandler(async (event) => {
  try {
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

    // Started / Confirmed Start / Finished were retired. Older app builds may still
    // send them, so they are saved as Booked / Booked / Completed.
    const parsedStatus = normalizeAppointmentStatus(parseInt(status, 10));
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
      const billingData = {};

      if (acquireSession && patientId != null) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: patientId },
          select: { patient_id: true },
        });

        if (!patient) {
          throw new Error("Patient not found");
        }

        // Re-activating without a prepaid session is allowed up to the cap of unbilled sessions.
        const { needsBilling } = await takeSession(tx, patientId);
        billingData.needs_billing = needsBilling;
        billingData.billing_waived = false;
        billingData.invoice_id = null;
      }

      if (releaseSession && patientId != null) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: patientId },
          select: { patient_id: true },
        });

        if (patient) {
          await giveSessionBack(tx, patientId);
        }
        // Cancelled: nothing left to bill.
        billingData.needs_billing = false;
        billingData.billing_waived = false;
        billingData.invoice_id = null;
      }

      return tx.appointments.update({
        where: {
          appointment_id: parseInt(appointment_id, 10),
        },
        data: {
          status: parsedStatus,
          updated_at: new Date(),
          ...billingData,
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
