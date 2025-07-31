export default defineEventHandler(async (event) => {
    try {
      const body = await readBody(event);
  
      const {
        patientID,
        fullname,
        nickname,
        gender,
        dateOfBirth,
        autismDiagnose,
        diagnosedDate,
      } = body;
  
      if (!patientID) {
        return {
          statusCode: 400,
          message: 'Missing patientID',
        };
      }
  
      // Update the user_patients table
      await prisma.user_patients.update({
        where: {
          patient_id: parseInt(patientID),
        },
        data: {
          fullname,
          nickname,
          gender,
          dob: dateOfBirth,
          autism_diagnose: autismDiagnose,
          diagnosed_on: diagnosedDate,
          update_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: 'Child updated successfully',
      };
    } catch (error) {
      console.error('Error updating child:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message,
      };
    }
  });
  