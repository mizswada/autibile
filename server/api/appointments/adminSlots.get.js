export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { date } = query;

    if (!date) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Date parameter is required'
      });
    }

    // Parse the date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid date format'
      });
    }

    // Get the start and end of the day
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get existing admin appointments for this date - use practitioner_id being null instead of is_admin_appointment field
    const existingAdminAppointments = await $fetch('/api/appointments/list', {
      method: 'GET',
      params: {
        start_date: startOfDay.toISOString(),
        end_date: endOfDay.toISOString(),
        is_admin: true
      }
    });

    const existingCount = existingAdminAppointments?.data?.length || 0;
    const maxSlots = 5;
    const availableSlots = Math.max(0, maxSlots - existingCount);

    // Generate available admin slots
    const adminSlots = [];
    if (availableSlots > 0) {
      // Create 5 standard time slots for admin appointments
      const timeSlots = [
        { id: 1, title: "Morning Slot (9:00 AM - 10:00 AM)", time: "09:00-10:00" },
        { id: 2, title: "Late Morning Slot (10:00 AM - 11:00 AM)", time: "10:00-11:00" },
        { id: 3, title: "Afternoon Slot (2:00 PM - 3:00 PM)", time: "14:00-15:00" },
        { id: 4, title: "Late Afternoon Slot (3:00 PM - 4:00 PM)", time: "15:00-16:00" },
        { id: 5, title: "Evening Slot (4:00 PM - 5:00 PM)", time: "16:00-17:00" }
      ];

      // Return available slots based on how many are already taken
      for (let i = 0; i < availableSlots; i++) {
        adminSlots.push({
          lookupID: `admin_${i + 1}`,
          title: timeSlots[i].title,
          value: timeSlots[i].time,
          isAvailable: true,
          slotType: 'admin'
        });
      }
    }

    return {
      success: true,
      message: `Found ${availableSlots} available admin slots for ${date}`,
      data: adminSlots,
      meta: {
        date: date,
        existingCount: existingCount,
        maxSlots: maxSlots,
        availableSlots: availableSlots
      }
    };

  } catch (error) {
    console.error('Error in adminSlots API:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to fetch admin slots',
      data: [],
      error: error.message
    };
  }
});
