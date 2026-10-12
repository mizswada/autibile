import prisma from "~/server/utils/prisma";
import { normalizeAppointmentStatus } from "~/utils/appointmentStatus";
import {
  reconcileUnbilled,
  releaseSession as giveSessionBack,
  takeSession,
} from "~/server/utils/sessionBalance";
import { linkCoveredAppointments } from "~/server/utils/coverage";
import { refreshInvoiceSessionDates } from "~/server/utils/invoiceDescription";
import { isAdminRequest } from "~/server/utils/reports/guard";

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
        // Only administrators may book on credit; therapists need a prepaid session.
        const { needsBilling } = await takeSession(tx, patientId, {
          maxUnbilled: isAdminRequest(event) ? undefined : 0,
        });
        billingData.needs_billing = needsBilling;
        billingData.billing_waived = false;
        billingData.invoice_id = null;
      }

      if (releaseSession && patientId != null) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: patientId },
          select: { patient_id: true },
        });

        // A waived appointment already got its session back when billing was waived.
        if (patient && !existingAppointment.billing_waived) {
          await giveSessionBack(tx, patientId);
        }
        // Cancelled: nothing left to bill.
        billingData.needs_billing = false;
        billingData.billing_waived = false;
        billingData.invoice_id = null;
      }

      const updated = await tx.appointments.update({
        where: {
          appointment_id: parseInt(appointment_id, 10),
        },
        data: {
          status: parsedStatus,
          updated_at: new Date(),
          ...billingData,
        },
      });

      // The freed session may cover an older unbilled appointment of that patient.
      if (releaseSession && patientId != null) {
        await reconcileUnbilled(tx, patientId);
      }

      // It no longer belongs to the invoice that billed it: keep that invoice's session dates right.
      if (releaseSession && existingAppointment.invoice_id && existingAppointment.needs_billing) {
        await refreshInvoiceSessionDates(tx, existingAppointment.invoice_id);
      }

      // Prepaid booking: remember which paid invoice the session came from.
      if (acquireSession && patientId != null && billingData.needs_billing === false) {
        await linkCoveredAppointments(tx, patientId, [parseInt(appointment_id, 10)]);
      }

      return updated;
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
