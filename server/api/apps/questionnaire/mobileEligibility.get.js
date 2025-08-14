export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { patientID, questionnaireID } = query;

    if (!patientID) {
      return {
        statusCode: 400,
        message: "Missing patient ID parameter",
      };
    }

    if (!questionnaireID) {
      return {
        statusCode: 400,
        message: "Missing questionnaire ID parameter",
      };
    }

    // Get patient information
    const patient = await prisma.user_patients.findUnique({
      where: {
        patient_id: parseInt(patientID)
      },
      select: {
        patient_id: true,
        fullname: true,
        mchatr_status: true,
        created_at: true
      }
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    // Check MCHAT-R eligibility based on questionnaire ID
    if (parseInt(questionnaireID) === 1) {
      // For MCHAT-R questionnaire (ID 1)
      const existingResponse = await prisma.questionnaires_responds.findFirst({
        where: {
          questionnaire_id: 1,
          patient_id: parseInt(patientID)
        }
      });

      const hasCompletedMchatr = !!existingResponse;
      const isEligible = patient.mchatr_status === 'Enable' || patient.mchatr_status === null;
      const canRetake = (patient.mchatr_status === 'Enable' || patient.mchatr_status === null) && hasCompletedMchatr;
      
      // Get MCHAT-R score if completed
      let mchatrScore = null;
      if (existingResponse) {
        mchatrScore = existingResponse.total_score;
      }

      return {
        statusCode: 200,
        message: "MCHAT-R eligibility check completed",
        data: {
          patient_id: patient.patient_id,
          patient_name: patient.fullname,
          mchatr_status: patient.mchatr_status,
          has_completed_mchatr: hasCompletedMchatr,
          is_eligible: isEligible,
          can_take_mchatr: isEligible,
          can_retake_mchatr: canRetake,
          mchatr_score: mchatrScore,
          is_eligible_for_questionnaire_2: mchatrScore !== null && mchatrScore >= 3 && mchatrScore <= 7,
          questionnaire_id: parseInt(questionnaireID),
          can_access_questionnaire: isEligible,
          access_reason: isEligible ? 
            (hasCompletedMchatr ? "Patient can retake MCHAT-R" : "Patient is eligible for MCHAT-R") : 
            "Patient is not eligible for MCHAT-R"
        }
      };

    } else if (parseInt(questionnaireID) === 2) {
      // For questionnaire ID 2 (follow-up questionnaire)
      const mchatrResponse = await prisma.questionnaires_responds.findFirst({
        where: {
          questionnaire_id: 1,
          patient_id: parseInt(patientID)
        }
      });

      const mchatrScore = mchatrResponse ? mchatrResponse.total_score : null;
      const isEligibleForQuestionnaire2 = mchatrScore !== null && mchatrScore >= 3 && mchatrScore <= 7;

      return {
        statusCode: 200,
        message: "Questionnaire 2 eligibility check completed",
        data: {
          patient_id: patient.patient_id,
          patient_name: patient.fullname,
          mchatr_status: patient.mchatr_status,
          has_completed_mchatr: !!mchatrResponse,
          mchatr_score: mchatrScore,
          is_eligible_for_questionnaire_2: isEligibleForQuestionnaire2,
          can_take_questionnaire_2: isEligibleForQuestionnaire2,
          questionnaire_id: parseInt(questionnaireID),
          can_access_questionnaire: isEligibleForQuestionnaire2,
          access_reason: isEligibleForQuestionnaire2 ? 
            `Patient scored ${mchatrScore} on MCHAT-R (eligible range: 3-7)` : 
            (mchatrScore === null ? "Patient has not completed MCHAT-R" : `Patient scored ${mchatrScore} on MCHAT-R (not in eligible range 3-7)`)
        }
      };

    } else {
      // For other questionnaires, check basic access
      return {
        statusCode: 200,
        message: "Questionnaire eligibility check completed",
        data: {
          patient_id: patient.patient_id,
          patient_name: patient.fullname,
          mchatr_status: patient.mchatr_status,
          questionnaire_id: parseInt(questionnaireID),
          can_access_questionnaire: true,
          access_reason: "Questionnaire is accessible to all patients"
        }
      };
    }

  } catch (error) {
    console.error("Error checking mobile eligibility:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
