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

    // Fetch nationality values from the 'lookup' table
    const availableSession = await prisma.lookup.findMany({
      where: {
        refCode: 'slotID',
      },
      select: {
        lookupID: true,
        title: true,
      },
    });

    return availableSession; 
  } catch (error) {
    console.error('Available Session fetch error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
  
  