// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    const { questionnaireID } = getQuery(event);
  
    if (!questionnaireID) {
      return {
        statusCode: 400,
        message: 'Missing questionnaire ID',
      };
    }
  
    try {
      const id = parseInt(questionnaireID);
      const currentDate = new Date();
  
      // 1. Find all questions linked to this questionnaire
      const questions = await prisma.questionnaires_questions.findMany({
        where: { 
          questionnaire_id: id,
          deleted_at: null
        },    
        select: { question_id: true },
      });
  
      const questionIDs = questions.map(q => q.question_id);
      
      // 2. Soft delete questions by setting deleted_at
      if (questionIDs.length > 0) {
        // Update questions
        await prisma.questionnaires_questions.updateMany({
          where: { 
            question_id: { in: questionIDs },
            deleted_at: null
          },
          data: { 
            deleted_at: currentDate,
            status: 'INACTIVE'
          }
        });
        
        // Also find and update any options related to these questions
        const options = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: { in: questionIDs },
            deleted_at: null
          },
          select: { option_id: true }
        });
        
        if (options.length > 0) {
          const optionIDs = options.map(opt => opt.option_id);
          
          await prisma.questionnaires_questions_action.updateMany({
            where: {
              option_id: { in: optionIDs },
              deleted_at: null
            },
            data: {
              deleted_at: currentDate
            }
          });
        }
      }
  
      // 3. Soft delete the questionnaire
      await prisma.questionnaires.update({
        where: { 
          questionnaire_id: id,
          deleted_at: null
        },
        data: { 
          deleted_at: currentDate,
          status: 'INACTIVE'
        }
      });
  
      return {
        statusCode: 200,
        message: 'Questionnaire and all related questions soft deleted successfully',
      };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: error.message
      };
    }
  });
  