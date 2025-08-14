export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionnaireID, currentQuestionID, selectedAnswers, includeOptions } = query;

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
        status: true
      }
    });

    if (!questionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    // Parse selected answers if provided
    let parsedAnswers = {};
    if (selectedAnswers) {
      try {
        parsedAnswers = JSON.parse(selectedAnswers);
      } catch (error) {
        console.error('Error parsing selectedAnswers:', error);
        parsedAnswers = {};
      }
    }

    // Get all questions for this questionnaire
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

    // Build the flow structure
    const flowStructure = {
      questionnaire: questionnaire,
      current_question: null,
      next_questions: [],
      conditional_sub_questions: [],
      progress: {
        current: 0,
        total: topLevelQuestions.length,
        percentage: 0
      }
    };

    // Find current question index
    let currentQuestionIndex = 0;
    if (currentQuestionID) {
      currentQuestionIndex = topLevelQuestions.findIndex(q => q.question_id === parseInt(currentQuestionID));
      if (currentQuestionIndex === -1) currentQuestionIndex = 0;
    }

    // Set current question
    if (topLevelQuestions[currentQuestionIndex]) {
      const currentQuestion = topLevelQuestions[currentQuestionIndex];
      
      // Get options for current question if requested
      let currentQuestionWithOptions = currentQuestion;
      if (includeOptions === 'true') {
        const options = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: currentQuestion.question_id,
            deleted_at: null
          },
          orderBy: { option_id: 'asc' }
        });
        currentQuestionWithOptions = { ...currentQuestion, options };
      }

      flowStructure.current_question = currentQuestionWithOptions;
    }

    // Calculate progress
    flowStructure.progress.current = currentQuestionIndex + 1;
    flowStructure.progress.percentage = Math.round((flowStructure.progress.current / flowStructure.progress.total) * 100);

    // Get next questions (remaining top-level questions)
    const nextQuestions = topLevelQuestions.slice(currentQuestionIndex + 1, currentQuestionIndex + 4); // Show next 3 questions
    flowStructure.next_questions = nextQuestions;

    // Check for conditional sub-questions based on current answers
    if (Object.keys(parsedAnswers).length > 0) {
      const conditionalSubQuestions = [];

      for (const [questionId, answer] of Object.entries(parsedAnswers)) {
        const question = topLevelQuestions.find(q => q.question_id === parseInt(questionId));
        if (question) {
          // Get the selected option to find conditional logic
          const selectedOption = await prisma.questionnaires_questions_action.findFirst({
            where: {
              question_id: parseInt(questionId),
              option_id: parseInt(answer),
              deleted_at: null
            }
          });

          if (selectedOption && selectedOption.conditional_sub_questions_ids) {
            try {
              const conditionalIds = JSON.parse(selectedOption.conditional_sub_questions_ids);
              if (conditionalIds.length > 0) {
                // Get conditional sub-questions
                const conditionalQuestions = await prisma.questionnaires_questions.findMany({
                  where: {
                    question_id: { in: conditionalIds },
                    parentID: parseInt(questionId),
                    questionnaire_id: parseInt(questionnaireID),
                    status: 'Active',
                    deleted_at: null
                  },
                  orderBy: { question_id: 'asc' }
                });

                // Get options for conditional questions if requested
                let conditionalQuestionsWithOptions = conditionalQuestions;
                if (includeOptions === 'true' && conditionalQuestions.length > 0) {
                  conditionalQuestionsWithOptions = await Promise.all(
                    conditionalQuestions.map(async (q) => {
                      const options = await prisma.questionnaires_questions_action.findMany({
                        where: {
                          question_id: q.question_id,
                          deleted_at: null
                        },
                        orderBy: { option_id: 'asc' }
                      });
                      return { ...q, options };
                    })
                  );
                }

                conditionalSubQuestions.push({
                  parent_question_id: parseInt(questionId),
                  parent_question_text: question.question_text_bi || question.question_text_bm,
                  selected_option: {
                    option_id: selectedOption.option_id,
                    option_value: selectedOption.option_value,
                    option_title: selectedOption.option_title
                  },
                  sub_questions: conditionalQuestionsWithOptions
                });
              }
            } catch (error) {
              console.error('Error parsing conditional sub-questions IDs:', error);
            }
          }
        }
      }

      flowStructure.conditional_sub_questions = conditionalSubQuestions;
    }

    return {
      statusCode: 200,
      message: "Questionnaire flow retrieved successfully",
      data: flowStructure,
    };

  } catch (error) {
    console.error("Error retrieving questionnaire flow:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
