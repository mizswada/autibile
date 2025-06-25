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

    const parents = await prisma.user_parents.findMany({
      orderBy: { created_at: 'desc' },
    });

    return {
      statusCode: 200,
      message: 'Success',
      data: parents,
    };

  } catch (error) {
      console.error('GET /api/parents/listParents error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
      };
    }
});
  