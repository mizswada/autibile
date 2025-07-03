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
    const nationality = await prisma.lookup.findMany({
      where: {
        refCode: 'nationality',
      },
      select: {
        lookupID: true,
        title: true,
      },
    });

    return nationality; 
  } catch (error) {
    console.error('Nationality fetch error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
  
  