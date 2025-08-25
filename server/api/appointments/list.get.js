import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    
    const query = getQuery(event);
    const { date, patient_id, practitioner_id, status, is_admin, start_date, end_date, appointment_id } = query;
    
    const filter = {};
    if (date) filter.date = new Date(date);
    if (start_date) filter.date = { gte: new Date(start_date) };
    if (end_date) filter.date = { ...filter.date, lte: new Date(end_date) };
    if (patient_id) filter.patient_id = parseInt(patient_id);
    if (practitioner_id) filter.practitioner_id = parseInt(practitioner_id);
    if (status) filter.status = parseInt(status);
    if (appointment_id) filter.appointment_id = parseInt(appointment_id);
    
    // Handle admin appointments filter - use practitioner_id being null instead of is_admin_appointment field
    if (is_admin !== undefined) {
      if (is_admin === 'true' || is_admin === true) {
        filter.practitioner_id = null;
      } else {
        filter.practitioner_id = { not: null };
      }
    }
    
    const appointments = await prisma.appointments.findMany({
      where: {
        ...filter,
        deleted_at: null
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
      // Handle admin appointments (no time slot) - check if practitioner_id is null
      const isAdminAppointment = appointment.practitioner_id === null;
      
      let slotTitle = 'Admin Slot';
      let startTime = "09:00";
      let endTime = "10:00";
      
      if (appointment.lookup?.title) {
        slotTitle = appointment.lookup.title;
        const timeRangeMatch = slotTitle.match(/(\d{1,2}\.\d{2})\s*(am|pm)/gi);
        
        if (timeRangeMatch && timeRangeMatch.length >= 2) {
          startTime = convertTo24Hour(timeRangeMatch[0]);
          endTime = convertTo24Hour(timeRangeMatch[1]);
        }
      }

      // Get sequential session number for this appointment
      const sessionNumber = appointment.sessionNumber || 1;
      
      // Create a more informative title that includes service and session number
      const patientName = appointment.user_patients?.fullname || 'Unknown Patient';
      const serviceName = appointment.service?.name || 'Unknown Service';
      const title = `${patientName} - ${serviceName} (Session ${sessionNumber})`;
      
      // Determine practitioner name - handle admin appointments
      let practitionerName = 'Admin';
      if (appointment.user_practitioners?.user?.userFullName) {
        practitionerName = appointment.user_practitioners.user.userFullName;
      }
      
      return {
        id: appointment.appointment_id,
        title: title,
        start: `${appointment.date.toISOString().split('T')[0]}T${startTime}:00`,
        end: `${appointment.date.toISOString().split('T')[0]}T${endTime}:00`,
        extendedProps: {
          patient_id: appointment.patient_id,
          patient_name: appointment.user_patients?.fullname,
          practitioner_id: appointment.practitioner_id,
          practitioner_name: practitionerName,
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
          is_admin_appointment: isAdminAppointment // Derived from practitioner_id being null
        }
      };
    });
    
    return { success: true, data: formattedAppointments };
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return { success: false, message: 'Failed to fetch appointments', error: error.message };
  }
});

// Helper to convert "9.00 am" or "10.00 pm" to "09:00" or "22:00"
function convertTo24Hour(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split('.').map(Number);
  if (period.toLowerCase() === 'pm' && hours !== 12) hours += 12;
  if (period.toLowerCase() === 'am' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
