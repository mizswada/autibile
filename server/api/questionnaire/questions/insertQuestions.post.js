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
        answer_type,
        parentID,
      } = body;
  
      // Basic validation
      if (
        questionnaire_id === undefined ||
        //question_bm === undefined || question_bm.trim() === '' ||
        //question_en === undefined || question_en.trim() === '' ||
        requiredQuestion === undefined || requiredQuestion === '' ||
        status === undefined || status === ''
        // Not making answer_type required since it might not be in the schema
      ) {
        return {
          statusCode: 400,
          message: "Missing required fields",
        };
      }

      // If parentID is provided, validate that it exists
      if (parentID) {
        const parentQuestion = await prisma.questionnaires_questions.findUnique({
          where: { question_id: parseInt(parentID) }
        });

        if (!parentQuestion) {
          return {
            statusCode: 400,
            message: "Parent question not found",
          };
        }

        // Ensure the parent question belongs to the same questionnaire
        if (parentQuestion.questionnaire_id !== parseInt(questionnaire_id)) {
          return {
            statusCode: 400,
            message: "Parent question must belong to the same questionnaire",
          };
        }
      }

      // Save to DB - use the correct relation format for questionnaires
      const saved = await prisma.questionnaires_questions.create({
        data: {
          questionnaires: {
            connect: { questionnaire_id: parseInt(questionnaire_id) }
          },
          question_text_bm: question_bm,
          question_text_bi: question_en,
          is_required: requiredQuestion === '1' || requiredQuestion === true ? true : false,
          status: status,
          // Only include answer_type if it's provided and not empty
          ...(answer_type && answer_type !== '' ? { answer_type: parseInt(answer_type) } : {}),
          // Add parentID if provided
          ...(parentID ? { parentID: parseInt(parentID) } : {}),
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
        message: `Internal server error: ${error.message}`,
      };
    }
  });
  
    