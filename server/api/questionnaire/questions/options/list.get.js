import { PrismaClient } from '@prisma/client';

// Added by: Firzana Huda 24 June 2025
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

    // Get question ID from query params
    const query = getQuery(event);
    const questionID = query.questionID;

    if (!questionID) {
      return {
        statusCode: 400,
        message: "Missing question ID",
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

    // Get options for the question using direct question_id filter
    const options = await prisma.questionnaires_questions_action.findMany({
      where: {
        question_id: parseInt(questionID),
        deleted_at: null
      },
      orderBy: {
        order_number: 'asc'
      }
    });

    return {
      statusCode: 200,
      message: "Options retrieved successfully",
      data: options,
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