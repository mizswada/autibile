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
      question_bm, 
      question_en, 
      requiredQuestion, 
      status,
      answer_type
    } = body;

    // Basic validation
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

    // Update the question
    const updatedQuestion = await prisma.questionnaires_questions.update({
      where: {
        question_id: parseInt(questionID)
      },
      data: {
        question_text_bm: question_bm,
        question_text_bi: question_en,
        is_required: requiredQuestion === '1' || requiredQuestion === true ? true : false,
        status: status,
        // Only include answer_type if it's provided and not empty
        ...(answer_type && answer_type !== '' ? { answer_type: parseInt(answer_type) } : {}),
        updated_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: "Question updated successfully",
      data: updatedQuestion,
    };

  } catch (error) {
    console.error("Error updating question:", error);
    return {
      statusCode: 500,
      message: `Internal server error: ${error.message}`,
    };
  }
}); 