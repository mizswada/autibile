import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  const prisma = new PrismaClient();
  const body = await readBody(event);

  const {
    patient_id,
    practitioner_id,
    book_by,
    service_id,
    date,
    slot_ID,
    status = 36,
    is_admin_appointment = false
  } = body;

  if (!patient_id || !date || !service_id) {
    return { success: false, message: 'Missing required fields' };
  }

  // For admin appointments, practitioner_id and slot_ID are not required
  if (!is_admin_appointment && (!practitioner_id || !slot_ID)) {
    return { success: false, message: 'Missing required fields for non-admin appointment' };
  }

  // Check patient's available sessions before allowing appointment creation
  const patient = await prisma.user_patients.findUnique({
    where: {
      patient_id: parseInt(patient_id),
      deleted_at: null
    },
    select: {
      patient_id: true,
      fullname: true,
      available_session: true,
      status: true
    }
  });

  if (!patient) {
    return { success: false, message: 'Patient not found' };
  }

  const availableSessions = patient.available_session || 0;
  
  if (availableSessions <= 0) {
    return { 
      success: false, 
      message: `Cannot create appointment. Patient ${patient.fullname} has no available sessions (${availableSessions}). Please purchase more sessions first.` 
    };
  }

  // For admin appointments, check if we haven't exceeded the 5 slots per day limit
  if (is_admin_appointment) {
    const adminAppointmentsCount = await prisma.appointments.count({
      where: {
        date: new Date(date),
        practitioner_id: null, // Use practitioner_id being null instead of is_admin_appointment field
        deleted_at: null
      }
    });

    if (adminAppointmentsCount >= 5) {
      return { 
        success: false, 
        message: `Cannot create admin appointment. Maximum of 5 admin slots per day reached for ${date}. Please select a different date or assign existing admin appointments first.` 
      };
    }
  } else {
    // For regular appointments, check if the time slot is already booked
    const existingAppointment = await prisma.appointments.findFirst({
      where: {
        practitioner_id: parseInt(practitioner_id),
        date: new Date(date),
        slot_ID: parseInt(slot_ID),
        deleted_at: null
      }
    });

    if (existingAppointment) {
      return { success: false, message: 'This time slot is already booked' };
    }
  }

  // Deduct 1 session from patient's available sessions when booking
  const newSessions = availableSessions - 1;
  
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
  
  console.log(`Deducted 1 session from patient ${patient.patient_id} (${patient.fullname}) when booking. Previous: ${availableSessions}, New: ${newSessions}`);

  // Prepare appointment data
  const appointmentData = {
    patient_id: parseInt(patient_id),
    book_by: parseInt(book_by),
    service_id: parseInt(service_id),
    date: new Date(date),
    status: parseInt(status),
    parent_rate: null,
    parent_comment: null,
    therapist_doctor_comment: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  // Add practitioner_id and slot_ID only for non-admin appointments
  if (!is_admin_appointment) {
    appointmentData.practitioner_id = parseInt(practitioner_id);
    appointmentData.slot_ID = parseInt(slot_ID);
  } else {
    // For admin appointments, set practitioner_id to null (this identifies it as admin)
    appointmentData.practitioner_id = null;
    appointmentData.slot_ID = null;
  }

  const appointment = await prisma.appointments.create({
    data: appointmentData
  });

  return {
    success: true,
    message: is_admin_appointment ? 
      'Admin appointment created successfully! You can assign this to a doctor/therapist on the appointment date.' : 
      'Appointment created successfully',
    data: appointment
  };
});
