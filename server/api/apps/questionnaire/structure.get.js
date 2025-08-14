export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionnaireID, includeOptions, includeConditionalSubQuestions } = query;

    if (!questionnaireID) {
      return {
        statusCode: 400,
        message: "Missing questionnaire ID parameter",
      };
    }

    // Get questionnaire details
    const questionnaire = await prisma.questionnaires.findUnique({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null
      },
      select: {
        questionnaire_id: true,
        title: true,
        description: true,
        header: true,
        status: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!questionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    // Get all questions for this questionnaire (top-level questions first)
    const allQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null
      },
      orderBy: [
        { parentID: 'asc' }, // null parentID first (top-level questions)
        { question_id: 'asc' }
      ]
    });

    // Separate top-level questions and sub-questions
    const topLevelQuestions = allQuestions.filter(q => !q.parentID);
    const subQuestions = allQuestions.filter(q => q.parentID);

    // Build the questionnaire structure
    const questionnaireStructure = {
      ...questionnaire,
      questions: []
    };

    // Process top-level questions and their sub-questions
    for (const topQuestion of topLevelQuestions) {
      const questionNode = {
        ...topQuestion,
        sub_questions: [],
        has_conditional_logic: false,
        conditional_options: []
      };

      // Get options for this question if requested
      if (includeOptions === 'true') {
        const options = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: topQuestion.question_id,
            deleted_at: null
          },
          orderBy: { option_id: 'asc' }
        });

        questionNode.options = options;

        // Check for conditional logic in options
        for (const option of options) {
          if (option.conditional_sub_questions_ids) {
            try {
              const conditionalIds = JSON.parse(option.conditional_sub_questions_ids);
              if (conditionalIds.length > 0) {
                questionNode.has_conditional_logic = true;
                
                // Get the actual conditional sub-questions with their options
                let conditionalSubQuestions = [];
                if (includeConditionalSubQuestions === 'true') {
                  conditionalSubQuestions = await prisma.questionnaires_questions.findMany({
                    where: {
                      question_id: { in: conditionalIds },
                      questionnaire_id: parseInt(questionnaireID),
                      deleted_at: null
                    },
                    orderBy: { question_id: 'asc' }
                  });

                  // Get options for each conditional sub-question
                  const conditionalSubQuestionsWithOptions = await Promise.all(
                    conditionalSubQuestions.map(async (q) => {
                      const qOptions = await prisma.questionnaires_questions_action.findMany({
                        where: {
                          question_id: q.question_id,
                          deleted_at: null
                        },
                        orderBy: { option_id: 'asc' }
                      });
                      return { ...q, options: qOptions };
                    })
                  );
                  
                  conditionalSubQuestions = conditionalSubQuestionsWithOptions;
                }

                questionNode.conditional_options.push({
                  option_id: option.option_id,
                  option_value: option.option_value,
                  option_title: option.option_title,
                  conditional_sub_questions_ids: conditionalIds,
                  // NEW: Include the actual conditional sub-questions
                  conditional_sub_questions: conditionalSubQuestions
                });
              }
            } catch (error) {
              console.error('Error parsing conditional sub-questions IDs:', error);
            }
          }
        }
      }

      // Get all sub-questions for this top-level question
      const questionSubQuestions = subQuestions.filter(q => q.parentID === topQuestion.question_id);
      
      // Process sub-questions
      for (const subQuestion of questionSubQuestions) {
        const subQuestionNode = {
          ...subQuestion,
          options: []
        };

        // Get options for sub-question if requested
        if (includeOptions === 'true') {
          const subOptions = await prisma.questionnaires_questions_action.findMany({
            where: {
              question_id: subQuestion.question_id,
              deleted_at: null
            },
            orderBy: { option_id: 'asc' }
          });
          subQuestionNode.options = subOptions;
        }

        questionNode.sub_questions.push(subQuestionNode);
      }

      questionnaireStructure.questions.push(questionNode);
    }

    return {
      statusCode: 200,
      message: "Questionnaire structure retrieved successfully",
      data: questionnaireStructure,
    };

  } catch (error) {
    console.error("Error retrieving questionnaire structure:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
