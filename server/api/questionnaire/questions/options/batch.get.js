// Added by: Assistant - Batch Options API for efficient loading
import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionIDs } = query;

    if (!questionIDs) {
      return {
        statusCode: 400,
        message: "Question IDs are required",
      };
    }

    // Parse question IDs from comma-separated string
    const questionIdArray = questionIDs.split(',').map(id => parseInt(id.trim()));

    // Get options for all questions in one query
    const allOptions = await prisma.questionnaires_questions_action.findMany({
      where: {
        question_id: {
          in: questionIdArray
        },
        deleted_at: null
      },
      orderBy: [
        { question_id: 'asc' },
        { option_id: 'asc' }
      ]
    });

    // Group options by question_id
    const optionsByQuestion = {};
    allOptions.forEach(option => {
      if (!optionsByQuestion[option.question_id]) {
        optionsByQuestion[option.question_id] = [];
      }
      optionsByQuestion[option.question_id].push(option);
    });

    return {
      statusCode: 200,
      message: "Options retrieved successfully",
      data: optionsByQuestion,
    };

  } catch (error) {
    console.error("Error retrieving question options:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
}); 