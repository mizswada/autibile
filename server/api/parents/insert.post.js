import sha256 from "crypto-js/sha256.js";

export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return { statusCode: 401, message: "Unauthorized: Missing user session" };
    }

    const body = await readBody(event);

    const {
      username,
      fullname,
      email,
      ic,
      password,
      confirmPassword,
      role,
      relationship,
      gender,
      dateOfBirth,
      nationality,
      phone,
      address1,
      address2,
      address3,
      city,
      postcode,
      state,
      status,
    } = body;

    if (!username || !fullname || !email || !ic || !password || !role || !phone) {
      return {
        statusCode: 400,
        message: "Missing required user fields",
      };
    }

    const hashedPassword = sha256(password).toString();

    // Step 1: Create user and link to parentID
    const user = await prisma.user.create({
      data: {
        userUsername: username,
        userFullName: fullname,
        userEmail: email,
        userIC: ic,
        userPhone: phone,
        userStatus: 'Active',
        userPassword: hashedPassword, // hash in real world
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


    const parent = await prisma.user_parents.create({
      data: {
        user: {
          connect: { userID: user.userID },
        },
        lookup_user_parents_parent_relationshipTolookup: relationship
          ? { connect: { lookupID: parseInt(relationship) } }
          : undefined,
        lookup_user_parents_parent_nationalityTolookup: nationality
          ? { connect: { lookupID: parseInt(nationality) } }
          : undefined,
        lookup_user_parents_parent_stateTolookup: state
          ? { connect: { lookupID: parseInt(state) } }
          : undefined,
    
        parent_gender: gender || '',
        parent_dob: dateOfBirth ? new Date(dateOfBirth) : new Date(),
        parent_phone: phone || '',
        parent_add1: address1 || '',
        parent_add2: address2 || '',
        parent_add3: address3 || '',
        parent_city: city || '',
        parent_postcode: postcode || '',
        parent_status: status || '',
        created_at: new Date(),
      },
    });
    

    return {
      statusCode: 200,
      message: "Parent created successfully",
      data: {
        user,
        parent,
      },
    };
  } catch (error) {
    console.error("Error creating user/parent:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
