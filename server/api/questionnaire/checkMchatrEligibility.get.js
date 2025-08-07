// Added by: Assistant - Check MCHAT-R Eligibility API
export default defineEventHandler(async (event) => {
  try {
    // Extract userID from the session context
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const query = getQuery(event);
    const { patientId } = query;

    if (!patientId) {
      return {
        statusCode: 400,
        message: "Patient ID is required",
      };
    }

    // Check if patient has already completed questionnaire ID 1 (MCHAT-R)
    const existingResponse = await prisma.questionnaires_responds.findFirst({
      where: {
        questionnaire_id: 1,
        patient_id: parseInt(patientId)
      }
    });

    // Get patient's mchatr_status
    const patient = await prisma.user_patients.findUnique({
      where: {
        patient_id: parseInt(patientId)
      },
      select: {
        patient_id: true,
        fullname: true,
        mchatr_status: true
      }
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    const hasCompleted = !!existingResponse;
    const isEligible = patient.mchatr_status !== 'Disable';
    
    // Get MCHAT-R score if completed
    let mchatrScore = null;
    if (existingResponse) {
      mchatrScore = existingResponse.total_score;
    }
    
    // Check eligibility for questionnaire ID 2
    const isEligibleForQuestionnaire2 = mchatrScore !== null && mchatrScore >= 3 && mchatrScore <= 7;

    return {
      statusCode: 200,
      message: "Eligibility check completed",
      data: {
        patient_id: patient.patient_id,
        patient_name: patient.fullname,
        mchatr_status: patient.mchatr_status,
        has_completed_mchatr: hasCompleted,
        is_eligible: isEligible && !hasCompleted,
        can_take_mchatr: isEligible && !hasCompleted,
        mchatr_score: mchatrScore,
        is_eligible_for_questionnaire_2: isEligibleForQuestionnaire2
      }
    };

  } catch (error) {
    console.error("Error checking MCHAT-R eligibility:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 