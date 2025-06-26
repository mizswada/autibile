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
  
      // Step 1: Delete question
      await prisma.questionnaires_questions.deleteMany({
        where: { question_id: id },
      });
    
      return {
        statusCode: 200,
        message: 'Question deleted successfully',
      };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  