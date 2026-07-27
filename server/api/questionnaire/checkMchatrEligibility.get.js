import { findActivePatient } from "~/server/utils/activeEntities";
import { getMchatrEligibility } from "~/server/utils/questionnaireAccess";

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

    const patient = await findActivePatient(prisma, patientId, {
      patient_id: true,
    });

    if (!patient) {
      return {
        statusCode: 404,
        message: "Patient not found or inactive",
      };
    }

    const eligibility = await getMchatrEligibility(parseInt(patientId));

    return {
      statusCode: 200,
      message: "Eligibility check completed",
      data: eligibility,
    };
  } catch (error) {
    console.error("Error checking MCHAT-R eligibility:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
