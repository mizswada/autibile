import {
  getMchatrEligibility,
  getQuestionnaireAccessInfo,
  MCHATR_QUESTIONNAIRE_ID,
  MCHATR_F_QUESTIONNAIRE_ID,
} from "~/server/utils/questionnaireAccess";

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

    const patient = await prisma.user_patients.findUnique({
      where: {
        patient_id: parseInt(patientID),
      },
      select: {
        patient_id: true,
        fullname: true,
        created_at: true,
      },
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    const questionnaireId = parseInt(questionnaireID);
    const accessInfo = await getQuestionnaireAccessInfo(
      parseInt(patientID),
      questionnaireId,
    );
    const mchatrEligibility = await getMchatrEligibility(parseInt(patientID));

    if (questionnaireId === MCHATR_QUESTIONNAIRE_ID) {
      return {
        statusCode: 200,
        message: "MCHAT-R eligibility check completed",
        data: {
          ...mchatrEligibility,
          questionnaire_id: questionnaireId,
          questionnaire_access: accessInfo,
          can_access_questionnaire: accessInfo.can_access,
          access_reason: accessInfo.access_reason,
        },
      };
    }

    if (questionnaireId === MCHATR_F_QUESTIONNAIRE_ID) {
      return {
        statusCode: 200,
        message: "Questionnaire 2 eligibility check completed",
        data: {
          ...mchatrEligibility,
          questionnaire_id: questionnaireId,
          questionnaire_access: accessInfo,
          can_access_questionnaire: accessInfo.can_access,
          can_take_questionnaire_2: accessInfo.can_access,
          access_reason: accessInfo.access_reason,
        },
      };
    }

    return {
      statusCode: 200,
      message: "Questionnaire eligibility check completed",
      data: {
        patient_id: patient.patient_id,
        patient_name: patient.fullname,
        questionnaire_id: questionnaireId,
        questionnaire_access: accessInfo,
        can_access_questionnaire: accessInfo.can_access,
        access_reason: accessInfo.access_reason,
        mchatr_eligibility: mchatrEligibility,
      },
    };
  } catch (error) {
    console.error("Error checking mobile eligibility:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    };
  }
});
