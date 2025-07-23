export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    console.log('body',body);

    const {
      parentID,
      relationship,
      gender,
      dateOfBirth,
      nationality,
      state,
      addressLine1,
      addressLine2,
      addressLine3,
      city,
      postcode,
      status,
    } = body;

    if (!parentID) {
      return {
        statusCode: 400,
        message: "Missing parentID",
      };
    }

    // Convert dateOfBirth to Date object if provided
    const dob = dateOfBirth ? new Date(dateOfBirth) : null;

    // Check if parent record exists for this user
    const existing = await prisma.user_parents.findFirst({
      where: { parent_id: Number(parentID) },
    });

    if (existing) {
      // Update existing parent
      await prisma.user_parents.update({
        where: { parent_id: existing.parent_id },
        data: {
          parent_relationship: relationship || null,
          parent_gender: gender || null,
          parent_dob: dob,
          parent_nationality: nationality || null,
          parent_add1: addressLine1 || '',
          parent_add2: addressLine2 || null,
          parent_add3: addressLine3 || null,
          parent_city: city || '',
          parent_postcode: postcode || '',
          parent_state: state || null,
          parent_status: 'Active',
          updated_at: new Date(),
        },
      });
    }

    return {
      statusCode: 200,
      message: "Parent details saved successfully",
    };
  } catch (error) {
    console.error('API /apps/parents/details error:', error);
    return {
      statusCode: 500,
      message: "Failed to save parent details",
    };
  }
});
