import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const query = getQuery(event);
    
    const { patient_id } = query;
    
    if (!patient_id) {
      return {
        success: false,
        message: 'Patient ID is required'
      };
    }
    
    // Get patient information including available sessions
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
      return {
        success: false,
        message: 'Patient not found'
      };
    }
    
    const availableSessions = patient.available_session || 0;
    const canBookAppointment = availableSessions > 0;
    
    return {
      success: true,
      data: {
        patient_id: patient.patient_id,
        patient_name: patient.fullname,
        available_sessions: availableSessions,
        can_book_appointment: canBookAppointment,
        status: patient.status
      },
      message: canBookAppointment 
        ? `Patient has ${availableSessions} available session(s)` 
        : `Patient has no available sessions (${availableSessions}). Cannot book appointment.`
    };
  } catch (error) {
    console.error('Error checking patient sessions:', error);
    return {
      success: false,
      message: 'Failed to check patient sessions',
      error: error.message
    };
  }
}); 