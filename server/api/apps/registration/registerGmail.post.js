export default defineEventHandler(async (event) => {
  try {

    const body = await readBody(event);

    const {
      email,
      role,
    } = body;

    if (!email) {
      return {
        statusCode: 400,
        message: "Missing required user fields",
      };
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({ 
      where: { userEmail: email } 
    });

    if (existingUser) {
      return {
        statusCode: 409,
        message: "Email already exists",
      };
    }

    // Step 1: Create user
    const user = await prisma.user.create({
      data: {
        userEmail: email,
        signInBy: 'Google',
        userStatus: 'Active',
        userCreatedDate: new Date(),
        userModifiedDate: new Date(),
      },
    });

    const userrole = await prisma.userrole.create({
      data: {
        userRoleUserID: user.userID,
        userRoleRoleID: parseInt(role),
        userRoleCreatedDate: new Date(),
      },
    });

    // Step 2: Create parent linked to user
    const parent = await prisma.user_parents.create({
      data: {
        user: {
          connect: { userID: user.userID },
        },
        lookup_user_parents_parent_relationshipTolookup: undefined,
        lookup_user_parents_parent_nationalityTolookup: undefined,
        lookup_user_parents_parent_stateTolookup: undefined,
    
        parent_gender: '',
        parent_dob: null,
        parent_phone: '',
        parent_add1: '',
        parent_add2: '',
        parent_add3: '',
        parent_city: '',
        parent_postcode: '',
        parent_status: 'Active',
        created_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Parent created successfully",
      userID: user.userID,
      parentID: parent.parent_id,
      data: {
        user,
        parent,
      },
    };

  } catch (error) {
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
