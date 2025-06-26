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
  
      // Step 1: Get all questionnaires
      const questionnaires = await prisma.questionnaires.findMany({
        orderBy: { created_at: 'desc' },
        select: {
          questionnaire_id: true,
          title: true,
          description: true,
          status: true,
        },
      });
  
      if (!questionnaires.length) {
        return {
          statusCode: 200,
          message: 'No questionnaires found',
          data: [],
        };
      }
  
      // Step 2: Get all questions linked to those questionnaires
      const questionnaireIDs = questionnaires.map(q => q.questionnaire_id);
  
      const questions = await prisma.questionnaires_questions.findMany({
        where: {
          questionnaire_id: { in: questionnaireIDs },
        },
        select: {
          question_id: true,
          questionnaire_id: true,
          question_text_bm: true,
          question_text_bi: true,
          is_required: true,
          status: true,
        },
      });
  
      // Step 3: Group questions by questionnaire_id
      const questionsMap = {};
      for (const question of questions) {
        if (!questionsMap[question.questionnaire_id]) {
          questionsMap[question.questionnaire_id] = [];
        }
        questionsMap[question.questionnaire_id].push(question);
      }
  
      // Step 4: Merge questions into each questionnaire
      const mergedData = questionnaires.map(q => ({
        ...q,
        questionnaires_questions: questionsMap[q.questionnaire_id] || [],
      }));

      console.log(mergedData);
  
      return {
        statusCode: 200,
        message: 'Success',
        data: mergedData,
      };
    } catch (error) {
      console.error('GET /api/questionnaire/listQuestionnaires error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
      };
    }
  });
  