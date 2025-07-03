// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  const parentID = parseInt(getQuery(event).parentID);

  if (!parentID) {
    return {
      statusCode: 400,
      message: 'Missing parent ID',
    };
  }

  try {
    const parent = await prisma.user_parents.findUnique({
      where: { parent_id: parentID },
      include: {
        user: {
          select: {
            userFullName: true,
            userEmail: true,
            userPhone: true,
            userIC: true,
          },
        },
      },
    });

    if (!parent) {
      return {
        statusCode: 404,
        message: 'Parent not found',
      };
    }

    return {
      statusCode: 200,
      message: 'Success',
      data: {
        parentID: parent.parent_id,
        fullName: parent.user?.userFullName || '',
        email: parent.user?.userEmail || '',
        ic: parent.user?.userIC || '',
        phone: parent.user?.userPhone || '',
        relationship: parent.parent_relationship,
        gender: parent.parent_gender,
        dateOfBirth: parent.parent_dob,
        nationality: parent.parent_nationality,
        addressLine1: parent.parent_add1 || '',
        addressLine2: parent.parent_add2 || '',
        addressLine3: parent.parent_add3 || '',
        city: parent.parent_city,
        postcode: parent.parent_postcode,
        state: parent.parent_state,
        status: parent.parent_status,
      },
    };
  } catch (err) {
    console.error('Fetch error:', err);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
