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
  
      // 1. Find all child IDs linked to this parent
      const links = await prisma.questionnaires_questions.findMany({
        where: { questionnaire_id: id },    
        select: { question_id: true },
      });
  
      const childIDs = links.map(link => link.question_id);
      
      // 2. Delete actual child data from questions
      if (childIDs.length > 0) {
        await prisma.questionnaires_questions.deleteMany({
          where: { question_id: { in: childIDs } },
        });
      }
  
      // 3. Delete the parent
      await prisma.questionnaires.delete({
        where: { questionnaire_id: id },
      });
  
      return {
        statusCode: 200,
        message: 'Questionnaire and all related questions deleted successfully',
      };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  