// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    // Get search query from URL params
    const query = getQuery(event).query;
    
    if (!query || query.trim() === '') {
      return {
        statusCode: 400,
        message: "Search query is required",
      };
    }

    // Search for questions that match the query in either BM or English text
    const questions = await prisma.questionnaires_questions.findMany({
      where: {
        OR: [
          { question_text_bm: { contains: query, mode: 'insensitive' } },
          { question_text_bi: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        question_id: true,
        questionnaire_id: true,
        question_text_bm: true,
        question_text_bi: true,
        is_required: true,
        status: true,
        questionnaires: {
          select: {
            title: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 20, // Limit results to avoid overwhelming response
    });

    // Map the results to match frontend structure
    const mappedQuestions = questions.map(q => ({
      id: q.question_id,
      questionnaire_id: q.questionnaire_id,
      questionnaire_name: q.questionnaires?.title || 'Unknown',
      question_bm: q.question_text_bm,
      question_en: q.question_text_bi,
      requiredQuestion: q.is_required,
      status: q.status,
    }));

    return {
      statusCode: 200,
      message: "Success",
      data: mappedQuestions,
    };
  } catch (error) {
    console.error('Search questions error:', error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
    };
  }
}); 