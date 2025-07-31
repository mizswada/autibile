import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const body = await readBody(event);
    
    // Extract only parent feedback data from request body
    const {
      appointment_id,
      parent_rate,
      parent_comment
    } = body;
    
    // Validate required fields
    if (!appointment_id) {
      return {
        success: false,
        message: 'Missing required field: appointment_id'
      };
    }
    
    // Check if appointment exists
    const existingAppointment = await prisma.appointments.findUnique({
      where: {
        appointment_id: parseInt(appointment_id)
      }
    });
    
    if (!existingAppointment) {
      return {
        success: false,
        message: 'Appointment not found'
      };
    }
    
    // Validate parent_rate if provided
    if (parent_rate !== undefined) {
      const rate = parseFloat(parent_rate);
      if (isNaN(rate) || rate < 1 || rate > 5) {
        return {
          success: false,
          message: 'Parent rating must be a number between 1 and 5'
        };
      }
    }
    
    // Prepare update data - only parent feedback fields
    const updateData = {};
    
    if (parent_rate !== undefined) {
      updateData.parent_rate = parseFloat(parent_rate);
    }
    
    if (parent_comment !== undefined) {
      updateData.parent_comment = parent_comment;
    }
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();
    
    // Update the appointment with only parent feedback
    const updatedAppointment = await prisma.appointments.update({
      where: {
        appointment_id: parseInt(appointment_id)
      },
      data: updateData,
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true
          }
        },
        user_practitioners: {
          select: {
            practitioner_id: true,
            user: {
              select: {
                userFullName: true
              }
            }
          }
        },
        service: {
          select: {
            service_id: true,
            name: true
          }
        }
      }
    });
    
    return {
      success: true,
      message: 'Parent feedback updated successfully',
      data: {
        appointment_id: updatedAppointment.appointment_id,
        parent_rate: updatedAppointment.parent_rate,
        parent_comment: updatedAppointment.parent_comment,
        updated_at: updatedAppointment.updated_at,
        patient: updatedAppointment.user_patients ? {
          patient_id: updatedAppointment.user_patients.patient_id,
          fullname: updatedAppointment.user_patients.fullname
        } : null,
        practitioner: updatedAppointment.user_practitioners ? {
          practitioner_id: updatedAppointment.user_practitioners.practitioner_id,
          fullname: updatedAppointment.user_practitioners.user?.userFullName
        } : null,
        service: updatedAppointment.service ? {
          service_id: updatedAppointment.service.service_id,
          service_name: updatedAppointment.service.name
        } : null
      }
    };
  } catch (error) {
    console.error('Error updating parent feedback:', error);
    return {
      success: false,
      message: 'Failed to update parent feedback',
      error: error.message
    };
  }
}); 