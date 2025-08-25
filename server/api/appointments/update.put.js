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
      therapist_doctor_comment,
      is_admin_appointment,
      assigned_date
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
    
    // Check if status is being changed to "Cancelled" (37) - add back 1 session
    if (status !== undefined && parseInt(status) === 37 && existingAppointment.status !== 37) {
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
        const newSessions = currentSessions + 1;
        
        // Add back 1 session when appointment is cancelled
        await prisma.user_patients.update({
          where: {
            patient_id: patient.patient_id
          },
          data: {
            available_session: newSessions,
            update_at: new Date()
          }
        });
        
        console.log(`Added back 1 session to patient ${patient.patient_id} (${patient.fullname}) when cancelling. Previous: ${currentSessions}, New: ${newSessions}`);
      }
    }
    
    // Handle admin appointment assignment - check if current appointment is admin (practitioner_id is null)
    const isCurrentlyAdmin = existingAppointment.practitioner_id === null;
    
    if (is_admin_appointment === false && isCurrentlyAdmin) {
      // Converting from admin appointment to regular appointment
      if (!practitioner_id) {
        return {
          success: false,
          message: 'Practitioner ID is required when converting admin appointment to regular appointment'
        };
      }
      
      // Check if the new time slot is already booked
      if (date && slot_ID) {
        const slotBooked = await prisma.appointments.findFirst({
          where: {
            appointment_id: {
              not: parseInt(appointment_id)
            },
            practitioner_id: parseInt(practitioner_id),
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
    }
    
    // Handle regular appointment updates
    if (!is_admin_appointment && date && slot_ID && practitioner_id) {
      // Check if the new time slot is already booked (if changing date or slot)
      if (new Date(date).toDateString() !== new Date(existingAppointment.date).toDateString() || 
          parseInt(slot_ID) !== existingAppointment.slot_ID ||
          parseInt(practitioner_id) !== existingAppointment.practitioner_id) {
        
        const slotBooked = await prisma.appointments.findFirst({
          where: {
            appointment_id: {
              not: parseInt(appointment_id)
            },
            practitioner_id: parseInt(practitioner_id),
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
    }
    
    // Prepare update data
    const updateData = {};
    
    if (patient_id) updateData.patient_id = parseInt(patient_id);
    if (service_id) updateData.service_id = parseInt(service_id);
    if (date) updateData.date = new Date(date);
    if (status !== undefined) updateData.status = parseInt(status);
    if (parent_rate) updateData.parent_rate = parseFloat(parent_rate);
    if (parent_comment !== undefined) updateData.parent_comment = parent_comment;
    if (therapist_doctor_comment !== undefined) updateData.therapist_doctor_comment = therapist_doctor_comment;
    
    // Handle practitioner_id and slot_ID based on admin status
    if (is_admin_appointment === true) {
      // Converting to admin appointment
      updateData.practitioner_id = null;
      updateData.slot_ID = null;
    } else if (is_admin_appointment === false) {
      // Converting to regular appointment
      if (practitioner_id) updateData.practitioner_id = parseInt(practitioner_id);
      if (slot_ID) updateData.slot_ID = parseInt(slot_ID);
    } else {
      // Regular update (not changing admin status)
      if (practitioner_id !== undefined) updateData.practitioner_id = practitioner_id ? parseInt(practitioner_id) : null;
      if (slot_ID !== undefined) updateData.slot_ID = slot_ID ? parseInt(slot_ID) : null;
    }
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();
    
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