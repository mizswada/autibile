import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const body = await readBody(event);
    
    // Extract only practitioner feedback data from request body
    const {
      appointment_id,
      therapist_doctor_comment
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
    
    // Validate therapist_doctor_comment if provided
    if (therapist_doctor_comment !== undefined && therapist_doctor_comment.trim() === '') {
      return {
        success: false,
        message: 'Practitioner comment cannot be empty'
      };
    }
    
    // Prepare update data - only practitioner feedback field
    const updateData = {};
    
    if (therapist_doctor_comment !== undefined) {
      updateData.therapist_doctor_comment = therapist_doctor_comment;
    }
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();
    
    // Update the appointment with only practitioner feedback
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
      message: 'Practitioner feedback updated successfully',
      data: {
        appointment_id: updatedAppointment.appointment_id,
        therapist_doctor_comment: updatedAppointment.therapist_doctor_comment,
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
    console.error('Error updating practitioner feedback:', error);
    return {
      success: false,
      message: 'Failed to update practitioner feedback',
      error: error.message
    };
  }
}); 