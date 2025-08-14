export default defineEventHandler(async (event) => {
  try {
    // Get question IDs from query params
    const query = getQuery(event);
    const questionIDs = query.questionIDs;

    if (!questionIDs) {
      return {
        statusCode: 400,
        message: "Missing question IDs parameter",
      };
    }

    // Parse question IDs (comma-separated string)
    const questionIDArray = questionIDs.split(',').map(id => parseInt(id.trim()));

    if (questionIDArray.length === 0) {
      return {
        statusCode: 400,
        message: "Invalid question IDs format",
      };
    }

    // Get options for all questions in one query
    const allOptions = await prisma.questionnaires_questions_action.findMany({
      where: {
        question_id: { in: questionIDArray },
        deleted_at: null
      },
      orderBy: [
        { question_id: 'asc' },
        { option_id: 'asc' }
      ]
    });

    // Group options by question_id
    const optionsByQuestion = {};
    for (const option of allOptions) {
      if (!optionsByQuestion[option.question_id]) {
        optionsByQuestion[option.question_id] = [];
      }
      optionsByQuestion[option.question_id].push(option);
    }

    // Ensure all requested question IDs have an entry (even if empty)
    for (const questionId of questionIDArray) {
      if (!optionsByQuestion[questionId]) {
        optionsByQuestion[questionId] = [];
      }
    }

    return {
      statusCode: 200,
      message: "Batch options retrieved successfully",
      data: optionsByQuestion,
    };

  } catch (error) {
    console.error("Error retrieving batch options:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
