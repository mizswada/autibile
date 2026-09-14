import { initializeMchatrAccessForPatient } from "~/server/utils/questionnaireAccess";

export default defineEventHandler(async (event) => {
    try {
      const body = await readBody(event);
  
      const {
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
        parentID,
        userID,
      } = body;

      console.log(body);

      // Function to convert OKU card string to number
      // (kept identical to updateDetails.put.js so blank/'Yes'/'No' behave
      // the same on add and edit)
      const convertOKUCard = (okuCard) => {
        if (okuCard === 'Yes') return 1;
        if (okuCard === 'No') return 0;
        if (okuCard === 1 || okuCard === '1') return 1;
        if (okuCard === 0 || okuCard === '0') return 0;
        return null;
      };

      // Check if IC number already exists in user_patients
      const existingPatient = await prisma.user_patients.findFirst({
        where: { patient_ic: icNumber },
      });
  
      let patientID;
  
      if (existingPatient) {
        patientID = existingPatient.patient_id;
      } else {
        // Insert new patient if not exists
        const saved = await prisma.user_patients.create({
          data: {
            user_id: parseInt(userID), // parent's user ID
            fullname,
            nickname,
            gender,
            patient_ic: icNumber,
            dob: new Date(dateOfBirth),
            autism_diagnose: autismDiagnose || null,
            diagnosed_on: diagnosedDate ? new Date(diagnosedDate) : null,
            status,
            available_session: parseInt(availableSession) || 0,
            OKUCard: convertOKUCard(okuCard),
            treatment_type: treatmentType,
            created_at: new Date(),
          },
        });
        patientID = saved.patient_id;

        // Default-lock M-CHAT-R based on the child's age at creation.
        // Other questionnaires stay answerable (age warning only).
        try {
          await initializeMchatrAccessForPatient(
            patientID,
            new Date(dateOfBirth),
          );
        } catch (accessError) {
          console.error("Failed to initialize M-CHAT-R access:", accessError);
        }
      }
  
      // Check if link already exists
      const existingLink = await prisma.user_parent_patient.findFirst({
        where: {
          parent_id: parseInt(parentID),
          patient_id: patientID,
        },
      });
  
      if (existingLink) {
        return {
          statusCode: 409,
          message: "This child is already linked to this parent",
        };
      }
  
      // Insert into user_parent_patient table if not linked yet
      const parentPatientLink = await prisma.user_parent_patient.create({
        data: {
          parent_id: parseInt(parentID),
          patient_id: patientID,
        },
      });
  
      return {
        statusCode: 200,
        message: existingPatient
          ? "Existing child linked to parent successfully"
          : "New child added and linked to parent successfully",
        data: {
          patientID,
          parentPatientLink,
        },
      };
  
    } catch (error) {
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  