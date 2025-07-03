// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    const { practitionerID } = getQuery(event);
  
    if (!practitionerID) {
      return {
        statusCode: 400,
        message: 'Missing practitioner ID',
      };
    }
  
    try {
      const id = parseInt(practitionerID);
    
      await prisma.user_practitioners.delete({
        where: { practitioner_id: id },
      });
  
      return {
        statusCode: 200,
        message: 'Practitioner deleted successfully',
      };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  