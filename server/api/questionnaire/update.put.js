// Added by: Firzana Huda 24 June 2025
import { normalizeAgeMonthsInput } from "~/server/utils/questionnaireAge";

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

    const body = await readBody(event);

    const { 
      questionnaireID,
      title,
      description,
      header,
      status,
      min_age_months,
      max_age_months,
      age_warning_enabled,
      age_warning_message,
    } = body;

    // Basic validation
    if (!questionnaireID || !title || !description || !status) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    // Check if questionnaire exists
    const existingQuestionnaire = await prisma.questionnaires.findUnique({
      where: {
        questionnaire_id: parseInt(questionnaireID)
      }
    });

    if (!existingQuestionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    const minAge = normalizeAgeMonthsInput(min_age_months);
    const maxAge = normalizeAgeMonthsInput(max_age_months);

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      return {
        statusCode: 400,
        message: "Minimum age cannot be greater than maximum age",
      };
    }

    // Update the questionnaire
    const updated = await prisma.questionnaires.update({
      where: {
        questionnaire_id: parseInt(questionnaireID)
      },
      data: {
        title,
        description,
        header,
        status,
        min_age_months: minAge,
        max_age_months: maxAge,
        age_warning_enabled:
          age_warning_enabled === false || age_warning_enabled === "false"
            ? false
            : true,
        age_warning_message:
          typeof age_warning_message === "string" && age_warning_message.trim()
            ? age_warning_message.trim()
            : null,
        updated_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: "Questionnaire updated successfully",
      data: updated
    };

  } catch (error) {
    console.error("Error updating questionnaire:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
