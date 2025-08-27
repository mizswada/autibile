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

    const count = existingAdminAppointments?.data?.length || 0;

    return {
      success: true,
      message: `Found ${count} admin appointments for ${date}`,
      data: {
        count: count,
        date: date,
        maxSlots: 5,
        availableSlots: Math.max(0, 5 - count)
      }
    };

  } catch (error) {
    console.error('Error in adminSlotsCount API:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to fetch admin slots count',
      data: {
        count: 0,
        date: null,
        maxSlots: 5,
        availableSlots: 5
      },
      error: error.message
    };
  }
});
