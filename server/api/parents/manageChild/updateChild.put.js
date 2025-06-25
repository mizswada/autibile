// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    const body = await readBody(event);
  
    const {
      childID,
      nickname,
      gender,
      dateOfBirth,
      autismDiagnose,
      diagnosedDate,
      availableSession,
      status,
    } = body;
  
    if (!childID) {
      return { statusCode: 400, message: 'Missing child ID' };
    }
  
    try {
      await prisma.user_patients.update({
        where: { patient_id: parseInt(childID) },
        data: {
          nickname,
          gender,
          dob: new Date(dateOfBirth),
          autism_diagnose: autismDiagnose,
          diagnosed_on: new Date(diagnosedDate),
          available_session: parseInt(availableSession),
          status,
          update_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: 'Child updated successfully',
      };
    } catch (err) {
      console.error('Update error:', err);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  