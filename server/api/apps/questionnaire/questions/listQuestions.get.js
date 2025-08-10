export default defineEventHandler(async (event) => {
    try {  
      // Get query parameters
      const query = getQuery(event);
      const { questionnaireID, questionID, status, parentID, selectedOptionValue } = query;
  
      // Build where clause
      const whereClause = {
        deleted_at: null // Filter out soft-deleted records
      };
  
      if (questionnaireID) {
        whereClause.questionnaire_id = parseInt(questionnaireID);
      }
  
      if (questionID) {
        whereClause.question_id = parseInt(questionID);
      }
  
      if (status) {
        whereClause.status = status;
      }
      
      // If parentID is explicitly provided, filter by it
      // If not provided in the query, default to finding top-level questions (parentID is null)
      if (parentID !== undefined) {
        if (parentID === 'null' || parentID === '') {
          whereClause.parentID = null;
        } else {
          whereClause.parentID = parseInt(parentID);
        }
      }
  
      // Get questions
      const questions = await prisma.questionnaires_questions.findMany({
        where: whereClause,
        orderBy: {
          question_id: 'asc'
        }
      });
  
      // For each question, check if it has sub-questions and handle conditional logic
      const questionsWithSubInfo = await Promise.all(questions.map(async (question) => {
        // Count sub-questions for this question
        const subQuestionsCount = await prisma.questionnaires_questions.count({
          where: {
            parentID: question.question_id,
            deleted_at: null // Filter out soft-deleted records
          }
        });
  
        // If parentID is provided, also fetch the parent question details
        let parentQuestion = null;
        if (question.parentID) {
          parentQuestion = await prisma.questionnaires_questions.findUnique({
            where: {
              question_id: question.parentID
            },
            select: {
              question_text_bm: true,
              question_text_bi: true
            }
          });
        }
  
        // Get options for this question to check conditional logic
        const options = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: question.question_id,
            deleted_at: null
          },
          orderBy: {
            option_id: 'asc'
          }
        });
  
        // Check if this question has conditional sub-questions based on selected option
        let conditionalSubQuestions = [];
        if (selectedOptionValue && question.parentID) {
          // Get the selected option to find its conditional logic configuration
          const selectedOption = await prisma.questionnaires_questions_action.findFirst({
            where: {
              question_id: question.parentID,
              option_value: parseInt(selectedOptionValue),
              deleted_at: null
            }
          });
  
          if (selectedOption && selectedOption.conditional_sub_questions_ids) {
            try {
              const conditionalSubQuestionsIds = JSON.parse(selectedOption.conditional_sub_questions_ids);
              
              if (conditionalSubQuestionsIds.length > 0) {
                // Get specific conditional sub-questions for this option
                conditionalSubQuestions = await prisma.questionnaires_questions.findMany({
                  where: {
                    question_id: { in: conditionalSubQuestionsIds },
                    parentID: question.parentID,
                    questionnaire_id: parseInt(questionnaireID),
                    status: 'Active',
                    deleted_at: null
                  },
                  orderBy: {
                    question_id: 'asc'
                  }
                });
              }
            } catch (error) {
              console.error('Error parsing conditional sub-questions IDs:', error);
            }
          }
        }
  
        // If no conditional logic or no selected option, get all sub-questions
        if (conditionalSubQuestions.length === 0 && subQuestionsCount > 0) {
          conditionalSubQuestions = await prisma.questionnaires_questions.findMany({
            where: {
              parentID: question.question_id,
              questionnaire_id: parseInt(questionnaireID),
              status: 'Active',
              deleted_at: null
            },
            orderBy: {
              question_id: 'asc'
            }
          });
        }
  
        // Get options for conditional sub-questions
        const conditionalSubQuestionsWithOptions = await Promise.all(
          conditionalSubQuestions.map(async (subQuestion) => {
            const subOptions = await prisma.questionnaires_questions_action.findMany({
              where: {
                question_id: subQuestion.question_id,
                deleted_at: null
              },
              orderBy: {
                option_id: 'asc'
              }
            });
            return { ...subQuestion, options: subOptions };
          })
        );
  
        return {
          ...question,
          options: options,
          has_sub_questions: subQuestionsCount > 0,
          sub_questions_count: subQuestionsCount,
          parent_question: parentQuestion,
          conditional_sub_questions: conditionalSubQuestionsWithOptions
        };
      }));
  
      return {
        statusCode: 200,
        message: "Questions retrieved successfully",
        data: questionsWithSubInfo,
      };
  
    } catch (error) {
      console.error("Error retrieving questions:", error);
      return {
        statusCode: 500,
        message: "Internal server error",
        error: error.message
      };
    }
  }); 