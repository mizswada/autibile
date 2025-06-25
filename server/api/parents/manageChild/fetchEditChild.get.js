// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    const { childID } = getQuery(event);
  
    if (!childID) {
      return { statusCode: 400, message: 'Missing child ID' };
    }
  
    try {
      const child = await prisma.user_patients.findUnique({
        where: { patient_id: parseInt(childID) },
      });
  
      return {
        statusCode: 200,
        data: child,
      };
    } catch (error) {
      console.error('Error fetching child detail:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  