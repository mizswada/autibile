import { setAccessStatus } from "~/server/utils/questionnaireAccess";

export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);
    const { patientId, questionnaireId, accessStatus } = body;

    if (!patientId || !questionnaireId || !accessStatus) {
      return {
        statusCode: 400,
        message: "Patient ID, questionnaire ID, and access status are required",
      };
    }

    if (!["Enable", "Disable"].includes(accessStatus)) {
      return {
        statusCode: 400,
        message: "Access status must be either 'Enable' or 'Disable'",
      };
    }

    const patient = await prisma.user_patients.findUnique({
      where: { patient_id: parseInt(patientId) },
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    const questionnaire = await prisma.questionnaires.findUnique({
      where: { questionnaire_id: parseInt(questionnaireId) },
    });

    if (!questionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    const updated = await setAccessStatus(
      parseInt(patientId),
      parseInt(questionnaireId),
      accessStatus,
    );

    return {
      statusCode: 200,
      message: `Questionnaire access updated to ${accessStatus}`,
      data: {
        patient_id: updated.patient_id,
        questionnaire_id: updated.questionnaire_id,
        access_status: updated.access_status,
      },
    };
  } catch (error) {
    console.error("Error updating patient questionnaire access:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
