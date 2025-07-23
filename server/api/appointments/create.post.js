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
    status = 1
  } = body;

  if (!patient_id || !practitioner_id || !date || !slot_ID || !service_id) {
    return { success: false, message: 'Missing required fields' };
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

  const appointment = await prisma.appointments.create({
    data: {
      patient_id: parseInt(patient_id),
      practitioner_id: parseInt(practitioner_id),
      book_by: parseInt(book_by),
      service_id: parseInt(service_id),
      date: new Date(date),
      slot_ID: parseInt(slot_ID),
      status: parseInt(status),
      parent_rate: null,
      parent_comment: null,
      therapist_doctor_comment: null,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return {
    success: true,
    message: 'Appointment created successfully',
    data: appointment
  };
});
