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
    
    // Soft delete the appointment by setting deleted_at
    const deletedAppointment = await prisma.appointments.update({
      where: {
        appointment_id: parseInt(id)
      },
      data: {
        deleted_at: new Date()
      }
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