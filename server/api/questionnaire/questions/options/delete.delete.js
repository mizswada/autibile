// Added by: Firzana Huda 24 June 2025
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

    // Get option ID from query params
    const query = getQuery(event);
    const optionID = query.optionID;

    if (!optionID) {
      return {
        statusCode: 400,
        message: "Missing option ID",
      };
    }

    // Check if option exists
    const existingOption = await prisma.questionnaires_questions_action.findUnique({
      where: {
        option_id: parseInt(optionID)
      }
    });

    if (!existingOption) {
      return {
        statusCode: 404,
        message: "Option not found",
      };
    }

    // Always use soft delete for consistency
    const deleted = await prisma.questionnaires_questions_action.update({
      where: {
        option_id: parseInt(optionID)
      },
      data: {
        deleted_at: new Date()
      }
    });

    // Check if option is used in any answers (just for the message)
    const usedInAnswers = await prisma.questionnaires_questions_answers.findFirst({
      where: {
        option_id: parseInt(optionID)
      }
    });

    return {
      statusCode: 200,
      message: usedInAnswers 
        ? "Option soft deleted successfully (used in answers)"
        : "Option soft deleted successfully",
      data: deleted,
    };

  } catch (error) {
    console.error("Error deleting question option:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
}); 