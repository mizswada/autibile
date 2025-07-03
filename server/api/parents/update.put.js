// Added by: Firzana Huda 24 June 2025

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const parentID = body.parentID;

    if (!parentID) {
      return {
        statusCode: 400,
        message: 'Missing parent ID',
      };
    }

    // First, fetch parent record to get userID
    const parentRecord = await prisma.user_parents.findUnique({
      where: { parent_id: parseInt(parentID) },
    });

    if (!parentRecord) {
      return {
        statusCode: 404,
        message: 'Parent not found',
      };
    }

    const userID = parentRecord.user_id; // adjust field name if different in your schema

    // Update user table using correct userID
    // Build user update data dynamically
    const userUpdateData = {};

    if (body.fullName) userUpdateData.userFullName = body.fullName;
    if (body.email) userUpdateData.userEmail = body.email;
    if (body.phone) userUpdateData.userPhone = body.phone;
    if (body.ic) userUpdateData.userIC = body.ic;

    if (Object.keys(userUpdateData).length > 0) {
      userUpdateData.userModifiedDate = new Date();

      await prisma.user.update({
        where: { userID: userID },
        data: userUpdateData,
      });
    }


    // Update user_parents table
    const updatedParent = await prisma.user_parents.update({
      where: { parent_id: parseInt(parentID) },
      data: {
        lookup_user_parents_parent_relationshipTolookup: body.relationship
          ? { connect: { lookupID: parseInt(body.relationship) } }
          : undefined,
        lookup_user_parents_parent_nationalityTolookup: body.nationality
          ? { connect: { lookupID: parseInt(body.nationality) } }
          : undefined,
        lookup_user_parents_parent_stateTolookup: body.state
          ? { connect: { lookupID: parseInt(body.state) } }
          : undefined,

        parent_gender: body.gender || '',
        parent_dob: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        parent_add1: body.addressLine1 || '',
        parent_add2: body.addressLine2 || '',
        parent_add3: body.addressLine3 || '',
        parent_city: body.city || '',
        parent_postcode: body.postcode || '',
        parent_status: body.status || '',
        updated_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: 'Parent updated successfully',
      data: updatedParent,
    };
  } catch (error) {
    console.error('Update failed:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
});
