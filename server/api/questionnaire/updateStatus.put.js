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

    const body = await readBody(event);

    const { 
      questionnaireID,
      status 
    } = body;

    // Basic validation
    if (!questionnaireID || !status) {
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

    // Update the status
    const updated = await prisma.questionnaires.update({
      where: {
        questionnaire_id: parseInt(questionnaireID)
      },
      data: {
        status: status,
        updated_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: `Questionnaire status updated to ${status}`,
      data: updated
    };

  } catch (error) {
    console.error("Error updating questionnaire status:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 