import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
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
      if (shouldRefund) {
        const patient = await tx.user_patients.findUnique({
          where: { patient_id: existingAppointment.patient_id },
          select: { patient_id: true, available_session: true },
        });

        if (patient) {
          await tx.user_patients.update({
            where: { patient_id: existingAppointment.patient_id },
            data: {
              available_session: (patient.available_session || 0) + 1,
              update_at: new Date(),
            },
          });
        }
      }

      return tx.appointments.update({
        where: { appointment_id: parseInt(id) },
        data: { deleted_at: new Date() },
      });
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
      message: 'Failed to delete appointment',
      error: error.message
    };
  }
}); 