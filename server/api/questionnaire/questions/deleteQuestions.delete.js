// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    const { questionID } = getQuery(event);
  
    if (!questionID) {
      return {
        statusCode: 400,
        message: 'Missing question ID',
      };
    }
  
    try {
      const id = parseInt(questionID);
      const currentDate = new Date();
  
      // Step 1: Soft delete the question by setting deleted_at
      await prisma.questionnaires_questions.update({
        where: { 
          question_id: id,
          deleted_at: null
        },
        data: { 
          deleted_at: currentDate,
          status: 'INACTIVE'
        }
      });
      
      // Step 2: Also soft delete any options related to this question
      await prisma.questionnaires_questions_action.updateMany({
        where: {
          question_id: id,
          deleted_at: null
        },
        data: {
          deleted_at: currentDate
        }
      });
    
      return {
        statusCode: 200,
        message: 'Question soft deleted successfully',
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
  