export default defineEventHandler(async (event) => {
    try {
      const body = await readBody(event);
  
      const {
        patientID,
        fullname,
        nickname,
        gender,
        icNumber,
        dateOfBirth,
        autismDiagnose,
        diagnosedDate,
        availableSession,
        status,
        okuCard,
        treatmentType,
        mchatrStatus,
      } = body;
  
      if (!patientID) {
        return {
          statusCode: 400,
          message: 'Missing patientID',
        };
      }
  
      // Function to convert OKU card string to number
      const convertOKUCard = (okuCard) => {
        if (okuCard === 'Yes') return 1;
        if (okuCard === 'No') return 0;
        if (okuCard === 1 || okuCard === '1') return 1;
        if (okuCard === 0 || okuCard === '0') return 0;
        return null;
      };

      // Function to convert treatment type string to number
      const convertTreatmentType = (treatmentType) => {
        if (treatmentType === 'Centre') return '1';
        if (treatmentType === 'Online') return '2';
        if (treatmentType === 'In House') return '3';
        return treatmentType; // Return as-is if already a number or unknown
      };

      // Update the user_patients table
      await prisma.user_patients.update({
        where: {
          patient_id: parseInt(patientID),
        },
        data: {
          fullname,
          nickname,
          gender,
          patient_ic: icNumber,
          dob: dateOfBirth,
          autism_diagnose: autismDiagnose,
          diagnosed_on: diagnosedDate,
          status,
          available_session: availableSession ? parseInt(availableSession) : undefined,
          OKUCard: convertOKUCard(okuCard),
          treatment_type: convertTreatmentType(treatmentType),
          mchatr_status: mchatrStatus,
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
  