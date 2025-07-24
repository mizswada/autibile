import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    
    const query = getQuery(event);
    const { date, patient_id, practitioner_id, status } = query;
    
    const filter = {};
    if (date) filter.date = new Date(date);
    if (patient_id) filter.patient_id = parseInt(patient_id);
    if (practitioner_id) filter.practitioner_id = parseInt(practitioner_id);
    if (status) filter.status = parseInt(status);
    
    // For patient profile, we want ALL appointments including cancelled and deleted ones
    const appointments = await prisma.appointments.findMany({
      where: {
        ...filter
        // No deleted_at filter - include all appointments
        // No status filter - include cancelled appointments
      },
      include: {
        user_patients: true,
        user_practitioners: {
          include: { user: true }
        },
        service: true,
        lookup: true,
        user: true
      },
      orderBy: { date: 'asc' }
    });
    
    // Get sequential session numbers for each patient
    const patientAppointments = {};
    
    // Group appointments by patient
    for (const appointment of appointments) {
      const patientId = appointment.patient_id;
      if (!patientAppointments[patientId]) {
        patientAppointments[patientId] = [];
      }
      patientAppointments[patientId].push(appointment);
    }
    
    // Sort each patient's appointments by date and assign session numbers
    for (const patientId in patientAppointments) {
      patientAppointments[patientId].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Assign sequential session numbers
      patientAppointments[patientId].forEach((appointment, index) => {
        appointment.sessionNumber = index + 1;
      });
    }

    const formattedAppointments = appointments.map(appointment => {
      const slotTitle = appointment.lookup?.title || 'Slot';
      const timeRangeMatch = slotTitle.match(/(\d{1,2}\.\d{2})\s*(am|pm)/gi);
      
      let startTime = "09:00";
      let endTime = "10:00";

      if (timeRangeMatch && timeRangeMatch.length >= 2) {
        startTime = convertTo24Hour(timeRangeMatch[0]);
        endTime = convertTo24Hour(timeRangeMatch[1]);
      }

      // Get sequential session number for this appointment
      const sessionNumber = appointment.sessionNumber || 1;
      
      // Create a more informative title that includes service and session number
      const patientName = appointment.user_patients?.fullname || 'Unknown Patient';
      const serviceName = appointment.service?.name || 'Unknown Service';
      const title = `${patientName} - ${serviceName} (Session ${sessionNumber})`;
      
      return {
        id: appointment.appointment_id,
        title: title,
        start: `${appointment.date.toISOString().split('T')[0]}T${startTime}:00`,
        end: `${appointment.date.toISOString().split('T')[0]}T${endTime}:00`,
        extendedProps: {
          patient_id: appointment.patient_id,
          patient_name: appointment.user_patients?.fullname,
          practitioner_id: appointment.practitioner_id,
          practitioner_name: appointment.user_practitioners?.user?.userFullName,
          service_id: appointment.service_id,
          service_name: appointment.service?.name,
          status: appointment.status,
          booked_by: appointment.book_by,
          time_slot: slotTitle,
          parent_comment: appointment.parent_comment,
          therapist_doctor_comment: appointment.therapist_doctor_comment,
          parent_rate: appointment.parent_rate,
          slot_ID: appointment.slot_ID,
          session_number: sessionNumber,
          deleted_at: appointment.deleted_at // Include deletion status for patient profile
        }
      };
    });
    
    return { success: true, data: formattedAppointments };
  } catch (error) {
    console.error('Error fetching all appointments:', error);
    return {
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    };
  }
});

function convertTo24Hour(timeStr) {
  if (!timeStr) return "09:00";
  
  // Remove any extra text and extract time
  const timeMatch = timeStr.match(/(\d{1,2})\.(\d{2})\s*(am|pm)/i);
  if (!timeMatch) return "09:00";
  
  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2];
  const period = timeMatch[3].toLowerCase();
  
  if (period === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period === 'am' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
} 