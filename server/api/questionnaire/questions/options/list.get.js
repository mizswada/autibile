import { PrismaClient } from '@prisma/client';

// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionID } = query;

    if (!questionID) {
      return {
        statusCode: 400,
        message: "Question ID is required",
      };
    }

    const options = await prisma.questionnaires_questions_action.findMany({
      where: {
        question_id: parseInt(questionID),
        deleted_at: null
      },
      orderBy: {
        option_id: 'asc'
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
  }
}); 