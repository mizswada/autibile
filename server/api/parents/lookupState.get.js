// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user;

    if (!userID) {
      return {
        statusCode: 401,
        message: 'Unauthorized',
      };
    }

    const validatedUser = await prisma.user.findFirst({
      where: { userID: parseInt(userID) },
    });

    if (!validatedUser) {
      return {
        statusCode: 401,
        message: 'Unauthorized',
      };
    }

    // Fetch state values from the 'lookup' table
    const state = await prisma.lookup.findMany({
      where: {
        refCode: 'state',
      },
      select: {
        lookupID: true,
        title: true,
      },
    });

    return state; 
  } catch (error) {
    console.error('State fetch error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
  
  