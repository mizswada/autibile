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
      where: {
        deleted_at: null // Filter out soft-deleted records
      },
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
        lookup_user_parents_parent_relationshipTolookup: {
          select: {
            lookupID: true,
            title: true, 
          },
        },
        lookup_user_parents_parent_nationalityTolookup: {
          select: {
            lookupID: true,
            title: true,
          },
        },
        lookup_user_parents_parent_stateTolookup: {
          select: {
            lookupID: true,
            title: true,
          },
        },
      },
    });

    const formattedParents = parents.map(parent => ({
      parentID: parent.parent_id,
      userID: parent.user_id,
      username: parent.user?.userUsername || '',
      fullName: parent.user?.userFullName || '',
      email: parent.user?.userEmail || '',
      phone: parent.user?.userPhone || '',
      ic: parent.user?.userIC || '',
      relationship: parent.lookup_user_parents_parent_relationshipTolookup?.title || '',
      nationality: parent.lookup_user_parents_parent_nationalityTolookup?.title || '',
      state: parent.lookup_user_parents_parent_stateTolookup?.title || '',
      status: parent.parent_status || '',

      // Added fields from fetchEdit API
      gender: parent.parent_gender || '',
      dateOfBirth: parent.parent_dob || '',
      addressLine1: parent.parent_add1 || '',
      addressLine2: parent.parent_add2 || '',
      addressLine3: parent.parent_add3 || '',
      city: parent.parent_city || '',
      postcode: parent.parent_postcode || '',
    }));

    //console.log(formattedParents);

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
      error: error.message
    };
  }
});
