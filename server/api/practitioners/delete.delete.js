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
      const currentDate = new Date();
    
      // Soft delete by setting deleted_at
      await prisma.user_practitioners.update({
        where: { 
          practitioner_id: id,
          deleted_at: null // Only update if not already deleted
        },
        data: { 
          deleted_at: currentDate,
          status: 'INACTIVE'
        }
      });
  
      return {
        statusCode: 200,
        message: 'Practitioner soft deleted successfully',
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
  