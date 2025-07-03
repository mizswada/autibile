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
  
      const body = await readBody(event);
  
      const {    
        questionnaire_id,
        question_bm,
        question_en,
        requiredQuestion,
        status,
      } = body;
  
      // Basic validation
      if (
        questionnaire_id === undefined ||
        question_bm === undefined || question_bm.trim() === '' ||
        question_en === undefined || question_en.trim() === '' ||
        requiredQuestion === undefined || requiredQuestion === '' ||
        status === undefined || status === ''
      ) {
        return {
          statusCode: 400,
          message: "Missing required fields",
        };
      }

      // Save to DB
      const saved = await prisma.questionnaires_questions.create({
        data: {
          questionnaire_id: questionnaire_id,
          question_text_bm	: question_bm,
          question_text_bi: question_en,
          is_required: Boolean(requiredQuestion),
          status: status,
          created_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: "Question added successfully",
        data: saved,
      };
  
    } catch (error) {
      console.error("Error inserting question:", error);
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  
    