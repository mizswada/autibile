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

    // Get query parameters
    const query = getQuery(event);
    const { questionnaireID, questionID, status, parentID } = query;

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

    // For each question, check if it has sub-questions
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

      return {
        ...question,
        has_sub_questions: subQuestionsCount > 0,
        sub_questions_count: subQuestionsCount,
        parent_question: parentQuestion
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