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
      questionID,
      status 
    } = body;

    // Basic validation
    if (!questionID || !status) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    // Check if question exists
    const existingQuestion = await prisma.questionnaires_questions.findUnique({
      where: {
        question_id: parseInt(questionID)
      }
    });

    if (!existingQuestion) {
      return {
        statusCode: 404,
        message: "Question not found",
      };
    }

    // Update the status
    const updated = await prisma.questionnaires_questions.update({
      where: {
        question_id: parseInt(questionID)
      },
      data: {
        status: status,
        updated_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: `Question status updated to ${status}`,
      data: updated
    };

  } catch (error) {
    console.error("Error updating question status:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 