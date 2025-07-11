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
      title,
      description,
      header,
      status
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