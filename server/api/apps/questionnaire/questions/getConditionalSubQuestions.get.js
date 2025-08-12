// Enhanced Mobile Conditional Sub-Questions API

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionnaireID, parentQuestionID, selectedOptionValue, showAllSubQuestions, includeOptions } = query;

    console.log('API Debug - Input parameters:', { questionnaireID, parentQuestionID, selectedOptionValue, showAllSubQuestions, includeOptions });

    if (!questionnaireID || !parentQuestionID) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters: questionnaireID and parentQuestionID'
      });
    }

    // If showAllSubQuestions is true, return all sub-questions for this parent
    if (showAllSubQuestions === 'true') {
      console.log('API Debug - Fetching all sub-questions for parent:', parentQuestionID);
      
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

      console.log('API Debug - Found sub-questions (all):', subQuestions.length);

      // Get options for each sub-question if requested
      let subQuestionsWithOptions = subQuestions;
      if (includeOptions === 'true' && subQuestions.length > 0) {
        subQuestionsWithOptions = await Promise.all(
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
      }

      return {
        statusCode: 200,
        message: "All sub-questions retrieved successfully",
        data: {
          parent_question_id: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          sub_questions: subQuestionsWithOptions,
          total_count: subQuestions.length,
          conditional_logic_applied: false
        }
      };
    }

    // Conditional logic logic
    if (!selectedOptionValue) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameter: selectedOptionValue'
      });
    }

    console.log('API Debug - Looking for option with value:', selectedOptionValue, 'in question:', parentQuestionID);

    // Get the selected option to find its conditional logic configuration
    const selectedOption = await prisma.questionnaires_questions_action.findFirst({
      where: {
        question_id: parseInt(parentQuestionID),
        option_value: parseInt(selectedOptionValue),
        deleted_at: null
      }
    });

    console.log('API Debug - Found selected option:', selectedOption);

    if (!selectedOption) {
      console.log('API Debug - No option found for value:', selectedOptionValue);
      return {
        statusCode: 200,
        message: "No conditional sub-questions found for this option",
        data: {
          parent_question_id: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          selected_option: null,
          sub_questions: [],
          total_count: 0,
          conditional_logic_applied: true
        }
      };
    }

    // Check if this option has conditional logic configured
    const conditionalSubQuestionsIds = selectedOption.conditional_sub_questions_ids;
    console.log('API Debug - Conditional sub-questions IDs from option:', conditionalSubQuestionsIds);

    let subQuestionsToShow = [];

    if (conditionalSubQuestionsIds) {
      try {
        subQuestionsToShow = JSON.parse(conditionalSubQuestionsIds);
        console.log('API Debug - Parsed conditional IDs:', subQuestionsToShow);
      } catch (error) {
        console.error('API Debug - Error parsing conditional sub-questions IDs:', error);
        subQuestionsToShow = [];
      }
    }

    // If there are specific sub-questions configured for this option, show only those
    if (subQuestionsToShow.length > 0) {
      console.log('API Debug - Looking for specific sub-questions with IDs:', subQuestionsToShow);
      
      // First, try to find sub-questions by ID only (more flexible approach)
      let subQuestions = await prisma.questionnaires_questions.findMany({
        where: {
          question_id: { in: subQuestionsToShow },
          questionnaire_id: parseInt(questionnaireID),
          status: 'Active',
          deleted_at: null
        },
        orderBy: {
          question_id: 'asc'
        }
      });

      console.log('API Debug - Found sub-questions by ID only:', subQuestions.length);

      // If no questions found by ID only, try with parentID constraint
      if (subQuestions.length === 0) {
        console.log('API Debug - No questions found by ID only, trying with parentID constraint');
        subQuestions = await prisma.questionnaires_questions.findMany({
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
        console.log('API Debug - Found sub-questions with parentID constraint:', subQuestions.length);
      }

      // If still no questions found, try without status constraint
      if (subQuestions.length === 0) {
        console.log('API Debug - No questions found with status constraint, trying without status');
        subQuestions = await prisma.questionnaires_questions.findMany({
          where: {
            question_id: { in: subQuestionsToShow },
            questionnaire_id: parseInt(questionnaireID),
            deleted_at: null
          },
          orderBy: {
            question_id: 'asc'
          }
        });
        console.log('API Debug - Found sub-questions without status constraint:', subQuestions.length);
      }

      // Get options for each sub-question if requested
      let subQuestionsWithOptions = subQuestions;
      if (includeOptions === 'true' && subQuestions.length > 0) {
        subQuestionsWithOptions = await Promise.all(
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
      }

      return {
        statusCode: 200,
        message: "Conditional sub-questions retrieved successfully",
        data: {
          parent_question_id: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          selected_option: {
            option_id: selectedOption.option_id,
            option_value: selectedOption.option_value,
            option_title: selectedOption.option_title
          },
          sub_questions: subQuestionsWithOptions,
          total_count: subQuestions.length,
          conditional_logic_applied: true,
          conditional_sub_questions_ids: subQuestionsToShow
        }
      };
    } else {
      console.log('API Debug - No conditional logic configured, returning all sub-questions');
      
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

      console.log('API Debug - Found all sub-questions:', subQuestions.length);

      // Get options for each sub-question if requested
      let subQuestionsWithOptions = subQuestions;
      if (includeOptions === 'true' && subQuestions.length > 0) {
        subQuestionsWithOptions = await Promise.all(
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
      }

      return {
        statusCode: 200,
        message: "All sub-questions retrieved successfully (no conditional logic)",
        data: {
          parent_question_id: parseInt(parentQuestionID),
          questionnaire_id: parseInt(questionnaireID),
          selected_option: {
            option_id: selectedOption.option_id,
            option_value: selectedOption.option_value,
            option_title: selectedOption.option_title
          },
          sub_questions: subQuestionsWithOptions,
          total_count: subQuestions.length,
          conditional_logic_applied: false
        }
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
