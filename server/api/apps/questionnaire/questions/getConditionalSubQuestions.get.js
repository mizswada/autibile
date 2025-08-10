// Added by: Assistant - Mobile Conditional Sub-Questions API

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionnaireID, parentQuestionID, selectedOptionValue, showAllSubQuestions } = query;

    if (!questionnaireID || !parentQuestionID) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: questionnaireID and parentQuestionID'
      });
    }

    // If showAllSubQuestions is true, return all sub-questions for this parent
    if (showAllSubQuestions === 'true') {
      const subQuestions = await prisma.questionnaires_questions.findMany({
        where: {
          parentID: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          status: 'Active',
          deleted_at: null
        },
        orderBy: {
          question_id: 'asc'
        }
      });

      // Get options for each sub-question
      const subQuestionsWithOptions = await Promise.all(
        subQuestions.map(async (question) => {
          const options = await prisma.questionnaires_questions_action.findMany({
            where: {
              question_id: question.question_id,
              deleted_at: null
            },
            orderBy: {
              option_id: 'asc'
            }
          });
          return { ...question, options };
        })
      );

      return {
        statusCode: 200,
        message: "Conditional sub-questions retrieved successfully",
        data: subQuestionsWithOptions
      };
    }

    // Conditional logic logic
    if (!selectedOptionValue) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameter: selectedOptionValue'
      });
    }

    // Get the selected option to find its conditional logic configuration
    const selectedOption = await prisma.questionnaires_questions_action.findFirst({
      where: {
        question_id: parseInt(parentQuestionID),
        option_value: parseInt(selectedOptionValue),
        deleted_at: null
      }
    });

    if (!selectedOption) {
      return {
        statusCode: 200,
        message: "No conditional sub-questions found",
        data: []
      };
    }

    // Check if this option has conditional logic configured
    const conditionalSubQuestionsIds = selectedOption.conditional_sub_questions_ids;

    let subQuestionsToShow = [];

    if (conditionalSubQuestionsIds) {
      try {
        subQuestionsToShow = JSON.parse(conditionalSubQuestionsIds);
      } catch (error) {
        subQuestionsToShow = [];
      }
    }

    // If there are specific sub-questions configured for this option, show only those
    if (subQuestionsToShow.length > 0) {
      const subQuestions = await prisma.questionnaires_questions.findMany({
        where: {
          question_id: { in: subQuestionsToShow },
          parentID: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          status: 'Active',
          deleted_at: null
        },
        orderBy: {
          question_id: 'asc'
        }
      });

      // Get options for each sub-question
      const subQuestionsWithOptions = await Promise.all(
        subQuestions.map(async (question) => {
          const options = await prisma.questionnaires_questions_action.findMany({
            where: {
              question_id: question.question_id,
              deleted_at: null
            },
            orderBy: {
              option_id: 'asc'
            }
          });
          return { ...question, options };
        })
      );

      return {
        statusCode: 200,
        message: "Conditional sub-questions retrieved successfully",
        data: subQuestionsWithOptions
      };
    } else {
      // If no conditional logic is configured, return all sub-questions for this parent
      const subQuestions = await prisma.questionnaires_questions.findMany({
        where: {
          parentID: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          status: 'Active',
          deleted_at: null
        },
        orderBy: {
          question_id: 'asc'
        }
      });

      // Get options for each sub-question
      const subQuestionsWithOptions = await Promise.all(
        subQuestions.map(async (question) => {
          const options = await prisma.questionnaires_questions_action.findMany({
            where: {
              question_id: question.question_id,
              deleted_at: null
            },
            orderBy: {
              option_id: 'asc'
            }
          });
          return { ...question, options };
        })
      );

      return {
        statusCode: 200,
        message: "All sub-questions retrieved successfully",
        data: subQuestionsWithOptions
      };
    }
  } catch (error) {
    console.error('Error in getConditionalSubQuestions:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
      data: {
        error: error.message,
        stack: error.stack
      }
    });
  }
});
