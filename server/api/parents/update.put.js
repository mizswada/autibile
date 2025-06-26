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

    // Update user details (from `user` table)
    await prisma.user.updateMany({
      where: {
        userID: parseInt(parentID), // assumes userID === parentID (adjust if needed)
      },
      data: {
        userFullName: body.fullName,
        userEmail: body.email,
        userPhone: body.phone,
        userIC: body.ic,
      },
    });

    // Update parent-specific details (from `user_parents` table)
    const updated = await prisma.user_parents.update({
      where: { parent_id: parseInt(parentID) },
      data: {
        parent_relationship: parseInt(body.relationship),
        parent_gender: body.gender,
        parent_dob: new Date(body.dateOfBirth),
        parent_nationality: parseInt(body.nationality),
        parent_add1: body.addressLine1,
        parent_add2: body.addressLine2,
        parent_add3: body.addressLine3,
        parent_city: body.city,
        parent_postcode: body.postcode,
        parent_state: parseInt(body.state),
        parent_status: body.status,
      },
    });

    return {
      statusCode: 200,
      message: 'Parent updated successfully',
      data: updated,
    };
  } catch (error) {
    console.error('Update failed:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
});
