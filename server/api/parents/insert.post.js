// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    // Extract userID from the session context
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);

    const {
      relationship,     
      gender,
      dateOfBirth,
      nationality,       
      phone,
      numberOfChildren,
      childrenNames,     
      city,
      postcode,
      state,             
      status,
    } = body;

    // Basic validation
    if (
        relationship === undefined || relationship === null || relationship === '' ||
        !gender || !dateOfBirth ||
        nationality === undefined || nationality === null || nationality === '' ||
        !phone || !city || !postcode ||
        state === undefined || state === null || state === '' ||
        !status
      ) {
        return {
          statusCode: 400,
          message: "Missing required fields",
        };
      }
      

    // Map child names (limit to 3)
    const childName1 = childrenNames?.[0] || null;
    const childName2 = childrenNames?.[1] || null;
    const childName3 = childrenNames?.[2] || null;

    // Save to DB
    const saved = await prisma.user_parents.create({
      data: {
        user_id: parseInt(userID), // ← user ID from session
        parent_relationship: parseInt(relationship),
        parent_gender: gender,
        parent_dob: new Date(dateOfBirth),
        parent_nationality: parseInt(nationality),
        parent_phone: phone.toString(),
        parent_add1: childName1,
        parent_add2: childName2,
        parent_add3: childName3,
        parent_city: city,
        parent_postcode: postcode,
        parent_state: parseInt(state),
        parent_status: status,
        created_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Parent added successfully",
      data: saved,
    };

  } catch (error) {
    console.error("Error inserting parent:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});

  