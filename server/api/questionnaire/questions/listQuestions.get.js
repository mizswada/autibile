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

    // Get query parameters
    const query = getQuery(event);
    const { questionnaireID, questionID, status } = query;

    // Build where clause
    const whereClause = {};

    if (questionnaireID) {
      whereClause.questionnaire_id = parseInt(questionnaireID);
    }

    if (questionID) {
      whereClause.question_id = parseInt(questionID);
    }

    if (status) {
      whereClause.status = status;
    }

    // Get questions
    const questions = await prisma.questionnaires_questions.findMany({
      where: whereClause,
      orderBy: {
        question_id: 'asc'
      }
    });

    return {
      statusCode: 200,
      message: "Questions retrieved successfully",
      data: questions,
    };

  } catch (error) {
    console.error("Error retrieving questions:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 