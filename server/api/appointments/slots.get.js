import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const prisma = new PrismaClient();
    const query = getQuery(event);
    const { date, practitioner_id } = query;
    
    // Validate required fields
    if (!date || !practitioner_id) {
      return {
        success: false,
        message: 'Missing required fields: date and practitioner_id are required'
      };
    }
    
    // Get all time slots from lookup table (assuming type is 'TIME_SLOT')
    const allTimeSlots = await prisma.lookup.findMany({
      where: {
        refCode: 'slotID',
      },
      orderBy: {
        value: 'asc'
      }
    });
    
    if (!allTimeSlots || allTimeSlots.length === 0) {
      return {
        success: false,
        message: 'No time slots found in the system'
      };
    }
    
    // Get booked slots for the practitioner on the given date
    const bookedAppointments = await prisma.appointments.findMany({
      where: {
        practitioner_id: parseInt(practitioner_id),
        date: new Date(date),
        deleted_at: null
      },
      select: {
        slot_ID: true
      }
    });
    
    const bookedSlotIds = bookedAppointments.map(appointment => appointment.slot_ID);
    
    // Filter out booked slots
    const availableSlots = allTimeSlots.map(slot => {
      return {
        ...slot,
        isAvailable: !bookedSlotIds.includes(slot.lookupID)
      };
    });
    
    return {
      success: true,
      data: availableSlots
    };
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    return {
      success: false,
      message: 'Failed to fetch available time slots',
      error: error.message
    };
  }
}); 