// API to create sub-questions with automatic parentID assignment
export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);
    const { 
      questionnaire_id,
      parent_question_id, // The question that will have sub-questions
      question_bm,
      question_en,
      requiredQuestion = false,
      status = 'Active',
      answer_type = null
    } = body;

    // Validation
    if (!questionnaire_id || !parent_question_id || !question_en) {
      return {
        statusCode: 400,
        message: "Missing required fields: questionnaire_id, parent_question_id, question_en",
      };
    }

    // Verify parent question exists
    const parentQuestion = await prisma.questionnaires_questions.findUnique({
      where: { question_id: parseInt(parent_question_id) }
    });

    if (!parentQuestion) {
      return {
        statusCode: 400,
        message: "Parent question not found",
      };
    }

    // Verify parent question belongs to the same questionnaire
    if (parentQuestion.questionnaire_id !== parseInt(questionnaire_id)) {
      return {
        statusCode: 400,
        message: "Parent question must belong to the same questionnaire",
      };
    }

    // Create sub-question with correct parentID
    const subQuestion = await prisma.questionnaires_questions.create({
      data: {
        questionnaire_id: parseInt(questionnaire_id),
        parentID: parseInt(parent_question_id), // Set to the parent question ID
        question_text_bm: question_bm || question_en,
        question_text_bi: question_en,
        is_required: requiredQuestion === '1' || requiredQuestion === true,
        status: status,
        answer_type: answer_type ? parseInt(answer_type) : null,
        created_at: new Date(),
      }
    });

    return {
      statusCode: 200,
      message: "Sub-question created successfully",
      data: {
        sub_question: subQuestion,
        parent_question_id: parseInt(parent_question_id),
        questionnaire_id: parseInt(questionnaire_id)
      }
    };

  } catch (error) {
    console.error("Error creating sub-question:", error);
    return {
      statusCode: 500,
      message: `Internal server error: ${error.message}`,
    };
  }
});
