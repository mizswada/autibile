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

    // Join user_parents with user and lookup tables
    const parents = await prisma.user_parents.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            userUsername: true,
            userFullName: true,
            userEmail: true,
            userPhone: true,
            userIC: true,
          },
        },
      },
    });

    // Format response
    const formattedParents = parents.map(p => ({
      parentID: p.parent_id,
      userID: p.user_id,
      username: p.user?.userUsername || '',
      fullName: p.user?.userFullName || '',
      email: p.user?.userEmail || '',
      phone: p.user?.userPhone || '',
      ic: p.user?.userIC || '',
      status: p.parent_status || '',
    }));

    return {
      statusCode: 200,
      message: 'Success',
      data: formattedParents,
    };

  } catch (error) {
    console.error('GET /api/parents/listParents error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
