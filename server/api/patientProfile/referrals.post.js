export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { patientId, doctorName, specialty, hospital, date, reason, notes, status, followUpDate } = body;

    // Validate required fields
    if (!patientId || !doctorName || !specialty || !hospital || !date || !reason) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: patientId, doctorName, specialty, hospital, date, and reason are required'
      });
    }

    // In a real implementation, you would save to the database
    // For now, we'll just return a success response with the referral data
    const newReferral = {
      id: Date.now(), // Generate a unique ID
      patientId: parseInt(patientId),
      doctorName,
      specialty,
      hospital,
      date,
      reason,
      notes: notes || '',
      status: status || 'Scheduled',
      followUpDate: followUpDate || null,
      createdAt: new Date().toISOString()
    };

    return {
      statusCode: 201,
      data: newReferral,
      message: 'Referral created successfully'
    };

  } catch (error) {
    console.error('Error creating referral:', error);
    
    return {
      statusCode: 500,
      data: null,
      message: 'Failed to create referral'
    };
  }
}); 