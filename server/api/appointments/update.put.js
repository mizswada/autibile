import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const body = await readBody(event);
    
    // Extract appointment data from request body
    const {
      appointment_id,
      patient_id,
      practitioner_id,
      service_id,
      date,
      slot_ID,
      status,
      parent_rate,
      parent_comment,
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
    
    // Check if status is being changed to "Completed" and validate available sessions
    if (status !== undefined && parseInt(status) === 41 && existingAppointment.status !== 41) {
      // Get the patient's current available sessions
      const patient = await prisma.user_patients.findUnique({
        where: {
          patient_id: existingAppointment.patient_id
        },
        select: {
          patient_id: true,
          fullname: true,
          available_session: true
        }
      });
      
      if (!patient) {
        return {
          success: false,
          message: 'Patient not found for this appointment'
        };
      }
      
      const currentSessions = patient.available_session || 0;
      
      if (currentSessions <= 0) {
        return {
          success: false,
          message: `Cannot mark appointment as completed. Patient ${patient.fullname} has no available sessions (${currentSessions}). Please purchase more sessions first.`
        };
      }
    }
    
    // Check if the new time slot is already booked (if changing date or slot)
    if (date && slot_ID && 
        (new Date(date).toDateString() !== new Date(existingAppointment.date).toDateString() || 
         parseInt(slot_ID) !== existingAppointment.slot_ID)) {
      
      const slotBooked = await prisma.appointments.findFirst({
        where: {
          appointment_id: {
            not: parseInt(appointment_id)
          },
          practitioner_id: parseInt(practitioner_id || existingAppointment.practitioner_id),
          date: new Date(date),
          slot_ID: parseInt(slot_ID),
          deleted_at: null
        }
      });
      
      if (slotBooked) {
        return {
          success: false,
          message: 'This time slot is already booked for the selected practitioner'
        };
      }
    }
    
    // Prepare update data
    const updateData = {};
    
    if (patient_id) updateData.patient_id = parseInt(patient_id);
    if (practitioner_id) updateData.practitioner_id = parseInt(practitioner_id);
    if (service_id) updateData.service_id = parseInt(service_id);
    if (date) updateData.date = new Date(date);
    if (slot_ID) updateData.slot_ID = parseInt(slot_ID);
    if (status !== undefined) updateData.status = parseInt(status);
    if (parent_rate) updateData.parent_rate = parseFloat(parent_rate);
    if (parent_comment !== undefined) updateData.parent_comment = parent_comment;
    if (therapist_doctor_comment !== undefined) updateData.therapist_doctor_comment = therapist_doctor_comment;
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();
    
    // Check if status is being changed to "Completed" (status = 41)
    if (status !== undefined && parseInt(status) === 41 && existingAppointment.status !== 41) {
      // Get the patient's current available sessions
      const patient = await prisma.user_patients.findUnique({
        where: {
          patient_id: existingAppointment.patient_id
        },
        select: {
          patient_id: true,
          fullname: true,
          available_session: true
        }
      });
      
      if (patient) {
        const currentSessions = patient.available_session || 0;
        
        if (currentSessions > 0) {
          // Deduct one session
          const newSessions = currentSessions - 1;
          
          // Update patient's available sessions
          await prisma.user_patients.update({
            where: {
              patient_id: patient.patient_id
            },
            data: {
              available_session: newSessions,
              update_at: new Date()
            }
          });
          
          console.log(`Deducted 1 session from patient ${patient.patient_id} (${patient.fullname}). Previous: ${currentSessions}, New: ${newSessions}`);
        } else {
          console.log(`Warning: Patient ${patient.patient_id} (${patient.fullname}) has no available sessions to deduct`);
        }
      } else {
        console.log(`Warning: Patient not found for appointment ${appointment_id}`);
      }
    }
    
    // Update the appointment
    const updatedAppointment = await prisma.appointments.update({
      where: {
        appointment_id: parseInt(appointment_id)
      },
      data: updateData
    });
    
    return {
      success: true,
      message: 'Appointment updated successfully',
      data: updatedAppointment
    };
  } catch (error) {
    console.error('Error updating appointment:', error);
    return {
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    };
  }
}); 