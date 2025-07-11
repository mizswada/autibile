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
