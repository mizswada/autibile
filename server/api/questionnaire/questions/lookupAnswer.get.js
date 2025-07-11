// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
  
    if (!userID) {
      return {
        statusCode: 401,
        message: 'Unauthorized',
      };
    }
  
    // Fetch answer type values from the 'lookup' table
    const answerTypes = await prisma.lookup.findMany({
      where: {
        refCode: 'answerType',
      },
      select: {
        lookupID: true,
        title: true,
        value: true,
      },
    });
  
    return {
      statusCode: 200,
      message: 'Answer types retrieved successfully',
      data: answerTypes
    };
  } catch (error) {
    console.error('Answer Type fetch error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
    
    