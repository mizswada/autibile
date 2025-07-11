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
      answer_type,
      parentID  // Add parentID field for sub-questions
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

    // If parentID is provided, validate that it exists and is not the same as questionID
    // (a question cannot be its own parent)
    if (parentID) {
      if (parseInt(parentID) === parseInt(questionID)) {
        return {
          statusCode: 400,
          message: "A question cannot be its own parent",
        };
      }

      const parentQuestion = await prisma.questionnaires_questions.findUnique({
        where: { question_id: parseInt(parentID) }
      });

      if (!parentQuestion) {
        return {
          statusCode: 400,
          message: "Parent question not found",
        };
      }

      // Ensure the parent question belongs to the same questionnaire
      if (parentQuestion.questionnaire_id !== existingQuestion.questionnaire_id) {
        return {
          statusCode: 400,
          message: "Parent question must belong to the same questionnaire",
        };
      }

      // Check for circular references (e.g., A -> B -> A)
      // This is a simple check for direct circular reference
      // For deeper circular references, a more complex check would be needed
      const childQuestions = await prisma.questionnaires_questions.findMany({
        where: { parentID: parseInt(questionID) }
      });

      if (childQuestions.some(q => q.question_id === parseInt(parentID))) {
        return {
          statusCode: 400,
          message: "Circular parent-child relationship detected",
        };
      }
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
        // Update parentID if provided
        ...(parentID !== undefined ? { parentID: parentID ? parseInt(parentID) : null } : {}),
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