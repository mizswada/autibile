// Added by: Firzana Huda 24 June 2025
import { normalizeAgeMonthsInput } from "~/server/utils/questionnaireAge";
import {
  MCHATR_QUESTIONNAIRE_ID,
  disableMchatrForOutOfRangePatients,
} from "~/server/utils/questionnaireAccess";

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

    // Only touch age-related fields when the caller actually sent them, so
    // partial saves (e.g. header-only updates) can't accidentally clear them.
    const hasMinAge = Object.prototype.hasOwnProperty.call(body, "min_age_months");
    const hasMaxAge = Object.prototype.hasOwnProperty.call(body, "max_age_months");

    const data = {
      title,
      description,
      header,
      status,
      updated_at: new Date(),
    };

    if (hasMinAge) {
      data.min_age_months = minAge;
    }
    if (hasMaxAge) {
      data.max_age_months = maxAge;
    }
    if (Object.prototype.hasOwnProperty.call(body, "age_warning_enabled")) {
      data.age_warning_enabled =
        age_warning_enabled === false || age_warning_enabled === "false"
          ? false
          : true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "age_warning_message")) {
      data.age_warning_message =
        typeof age_warning_message === "string" && age_warning_message.trim()
          ? age_warning_message.trim()
          : null;
    }

    // Update the questionnaire
    const updated = await prisma.questionnaires.update({
      where: {
        questionnaire_id: parseInt(questionnaireID)
      },
      data
    });

    // Only M-CHAT-R auto lock/unlocks children when age limits change.
    // Other questionnaires keep access; parents just get an age warning.
    let mchatrRecompute = null;
    const ageChanged =
      (hasMinAge && minAge !== existingQuestionnaire.min_age_months) ||
      (hasMaxAge && maxAge !== existingQuestionnaire.max_age_months);

    if (parseInt(questionnaireID) === MCHATR_QUESTIONNAIRE_ID && ageChanged) {
      try {
        mchatrRecompute = await disableMchatrForOutOfRangePatients();
      } catch (recomputeError) {
        console.error(
          "Failed to recompute M-CHAT-R age locks:",
          recomputeError,
        );
      }
    }

    return {
      statusCode: 200,
      message: mchatrRecompute
        ? `Questionnaire updated successfully. M-CHAT-R disabled for ${mchatrRecompute.disabled} child(ren) outside the age range and unlocked for ${mchatrRecompute.enabled} child(ren) inside the age range.`
        : "Questionnaire updated successfully",
      data: updated,
      mchatrRecompute,
    };

  } catch (error) {
    console.error("Error updating questionnaire:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
