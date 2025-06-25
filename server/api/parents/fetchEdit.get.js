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
    });

    if (!parent) {
      return {
        statusCode: 404,
        message: 'Parent not found',
      };
    }

    const childrenNames = [
      parent.parent_add1,
      parent.parent_add2,
      parent.parent_add3,
    ].filter(name => !!name);

    return {
      statusCode: 200,
      message: 'Success',
      data: {
        relationship: parent.parent_relationship,
        gender: parent.parent_gender,
        dateOfBirth: parent.parent_dob,
        nationality: parent.parent_nationality,
        phone: parent.parent_phone,
        numberOfChildren: childrenNames.length,
        childrenNames,
        city: parent.parent_city,
        postcode: parent.parent_postcode,
        state: parent.parent_state,
        status: parent.parent_status,
        parentID: parent.parent_id,
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
  