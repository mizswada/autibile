// Added by: Assistant - Batch Options API for efficient loading
import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
  const prisma = new PrismaClient();
  
  try {
    // Extract userID from the session context
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    // Get question IDs from query params
    const query = getQuery(event);
    const questionIDs = query.questionIDs;

    if (!questionIDs) {
      return {
        statusCode: 400,
        message: "Missing question IDs",
      };
    }

    // Parse question IDs - can be comma-separated string or array
    let questionIdArray;
    if (typeof questionIDs === 'string') {
      questionIdArray = questionIDs.split(',').map(id => parseInt(id.trim()));
    } else if (Array.isArray(questionIDs)) {
      questionIdArray = questionIDs.map(id => parseInt(id));
    } else {
      questionIdArray = [parseInt(questionIDs)];
    }

    // Validate question IDs
    if (questionIdArray.some(id => isNaN(id))) {
      return {
        statusCode: 400,
        message: "Invalid question ID format",
      };
    }

    // Check if questions exist
    const existingQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        question_id: { in: questionIdArray }
      }
    });

    if (existingQuestions.length === 0) {
      return {
        statusCode: 404,
        message: "No questions found",
      };
    }

    // Get options for all questions in a single query
    const allOptions = await prisma.questionnaires_questions_action.findMany({
      where: {
        question_id: { in: questionIdArray },
        deleted_at: null
      },
      orderBy: [
        { question_id: 'asc' },
        { order_number: 'asc' }
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
  } finally {
    await prisma.$disconnect();
  }
}); 