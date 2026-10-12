import prisma from "~/server/utils/prisma";
import { reconcileUnbilled, releaseSession } from "~/server/utils/sessionBalance";
import { refreshInvoiceSessionDates } from "~/server/utils/invoiceDescription";
import { assertAppointmentUnchanged } from "~/server/utils/appointmentLock";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { id } = query;
    
    // Validate required fields
    if (!id) {
      return {
        success: false,
        message: 'Missing required field: id'
      };
    }
    
    // Check if appointment exists
    const existingAppointment = await prisma.appointments.findUnique({
      where: {
        appointment_id: parseInt(id)
      }
    });
    
    if (!existingAppointment) {
      return {
        success: false,
        message: 'Appointment not found'
      };
    }

    if (existingAppointment.deleted_at) {
      return {
        success: false,
        message: 'Appointment already deleted'
      };
    }

    // A session is still held unless the appointment was cancelled (status 37,
    // which already refunded it). Refund it atomically with the soft-delete.
    const shouldRefund =
      existingAppointment.status !== 37 && existingAppointment.patient_id != null;

    const deletedAppointment = await prisma.$transaction(async (tx) => {
      await assertAppointmentUnchanged(tx, existingAppointment);

      if (shouldRefund) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: existingAppointment.patient_id },
          select: { patient_id: true },
        });

        // A waived appointment already got its session back when billing was waived.
        if (patient && !existingAppointment.billing_waived) {
          await releaseSession(tx, existingAppointment.patient_id);
        }
      }

      // A deleted appointment can no longer be billed (billing fields are cleared).
      const deleted = await tx.appointments.update({
        where: { appointment_id: parseInt(id) },
        data: {
          deleted_at: new Date(),
          needs_billing: false,
          billing_waived: false,
          invoice_id: null,
        },
      });

      // It no longer belongs to the invoice that billed it: keep that invoice's session dates right.
      if (existingAppointment.invoice_id && existingAppointment.needs_billing) {
        await refreshInvoiceSessionDates(tx, existingAppointment.invoice_id);
      }

      // The freed session may cover an older unbilled appointment of that patient.
      if (shouldRefund) {
        await reconcileUnbilled(tx, existingAppointment.patient_id);
      }

      return deleted;
    });

    return {
      success: true,
      message: 'Appointment deleted successfully',
      data: deletedAppointment
    };
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return {
      success: false,
      message: String(error.message || '').startsWith('This appointment was changed')
        ? error.message
        : 'Failed to delete appointment',
      error: error.message
    };
  }
}); 