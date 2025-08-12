export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionnaireID, parentQuestionID } = query;

    if (!questionnaireID) {
      return {
        statusCode: 400,
        message: "Missing questionnaire ID parameter",
      };
    }

    const debugInfo = {
      questionnaire_id: parseInt(questionnaireID),
      parent_question_id: parentQuestionID ? parseInt(parentQuestionID) : null,
      timestamp: new Date().toISOString()
    };

    // Get questionnaire details
    const questionnaire = await prisma.questionnaires.findUnique({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null
      }
    });

    debugInfo.questionnaire = questionnaire;

    // Get all questions for this questionnaire
    const allQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null
      },
      orderBy: [
        { parentID: 'asc' },
        { question_id: 'asc' }
      ]
    });

    debugInfo.all_questions = allQuestions;

    // Separate top-level and sub-questions
    const topLevelQuestions = allQuestions.filter(q => !q.parentID);
    const subQuestions = allQuestions.filter(q => q.parentID);

    debugInfo.top_level_questions_count = topLevelQuestions.length;
    debugInfo.sub_questions_count = subQuestions.length;

    // Get options for top-level questions to check conditional logic
    const topLevelQuestionsWithOptions = await Promise.all(
      topLevelQuestions.map(async (question) => {
        const options = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: question.question_id,
            deleted_at: null
          },
          orderBy: { option_id: 'asc' }
        });

        // Check which options have conditional logic
        const optionsWithConditional = options.map(option => ({
          ...option,
          has_conditional_logic: !!option.conditional_sub_questions_ids,
          conditional_ids_parsed: option.conditional_sub_questions_ids ? 
            (() => {
              try { return JSON.parse(option.conditional_sub_questions_ids); } 
              catch (e) { return null; }
            })() : null
        }));

        return {
          ...question,
          options: optionsWithConditional,
          has_conditional_logic: optionsWithConditional.some(o => o.has_conditional_logic)
        };
      })
    );

    debugInfo.top_level_questions_with_options = topLevelQuestionsWithOptions;

    // If parentQuestionID is provided, get detailed info about that question
    if (parentQuestionID) {
      const parentQuestion = topLevelQuestionsWithOptions.find(q => q.question_id === parseInt(parentQuestionID));
      if (parentQuestion) {
        debugInfo.parent_question_details = parentQuestion;

        // Get sub-questions for this parent
        const parentSubQuestions = subQuestions.filter(q => q.parentID === parseInt(parentQuestionID));
        debugInfo.parent_sub_questions = parentSubQuestions;

        // Check if the conditional logic IDs actually exist as questions
        const conditionalOptions = parentQuestion.options.filter(o => o.has_conditional_logic);
        for (const option of conditionalOptions) {
          if (option.conditional_ids_parsed) {
            const conditionalQuestions = await prisma.questionnaires_questions.findMany({
              where: {
                question_id: { in: option.conditional_ids_parsed },
                deleted_at: null
              }
            });
            option.conditional_questions_found = conditionalQuestions;
            option.conditional_questions_count = conditionalQuestions.length;
          }
        }

        debugInfo.conditional_logic_analysis = conditionalOptions;
      }
    }

    return {
      statusCode: 200,
      message: "Debug information retrieved successfully",
      data: debugInfo,
    };

  } catch (error) {
    console.error("Error in debug API:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
