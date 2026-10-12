import { getAppAuth } from "~/server/utils/appsAuth";

export default defineEventHandler(async (event) => {
    try {
      const auth = await getAppAuth(event, { role: "Parents" });
      if (!auth.ok) {
        return { statusCode: auth.statusCode, message: auth.message };
      }

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

      // A signed-in parent can only change their own children.
      if (auth.authenticated && !auth.patientIds.includes(parseInt(patientID, 10))) {
        return { statusCode: 403, message: 'Forbidden: this child is not on your account' };
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
          autism_diagnose: autismDiagnose || null,
          diagnosed_on: diagnosedDate ? new Date(diagnosedDate) : null,
          status,
          OKUCard: convertOKUCard(okuCard),
          treatment_type: convertTreatmentType(treatmentType),
          mchatr_status: mchatrStatus,
          update_at: new Date(),
        },
      });

      if (mchatrStatus) {
        const { setAccessStatus, MCHATR_QUESTIONNAIRE_ID } = await import(
          "~/server/utils/questionnaireAccess"
        );
        await setAccessStatus(
          parseInt(patientID),
          MCHATR_QUESTIONNAIRE_ID,
          mchatrStatus,
        );
      }
  
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
  