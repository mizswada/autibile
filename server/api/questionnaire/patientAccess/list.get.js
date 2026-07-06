import { listAccessForPatient } from "~/server/utils/questionnaireAccess";

export default defineEventHandler(async (event) => {
  try {
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

    const patient = await prisma.user_patients.findUnique({
      where: { patient_id: parseInt(patientId) },
      select: { patient_id: true, fullname: true },
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    const accessList = await listAccessForPatient(parseInt(patientId));

    return {
      statusCode: 200,
      message: "Patient questionnaire access retrieved successfully",
      data: {
        patient_id: patient.patient_id,
        patient_name: patient.fullname,
        questionnaires: accessList,
      },
    };
  } catch (error) {
    console.error("Error listing patient questionnaire access:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
