import sha256 from "crypto-js/sha256.js";

export default defineEventHandler(async (event) => {
    try {
      const { userID } = event.context.user || {};
      if (!userID) {
        return {
          statusCode: 401,
          message: "Unauthorized: Missing user session",
        };
      }
  
      const body = await readBody(event);

      const { 
        username,
        fullname,
        email,
        ic,
        phone,
        password,
        confirmPassword,
        role,   
        type,
        registrationNo,
        specialty,
        department,
        qualification,
        experience,
        signature,
      } = body;
  
      // Basic validation
      if ( !username || !fullname || !email || !ic || !password || !role || !phone ) 
      {
        return {
          statusCode: 400,
          message: "Missing required fields",
        };
      }

      const hashedPassword = sha256(password).toString();

      // Step 1: Create user
      const user = await prisma.user.create({
        data: {
          userUsername: username,
          userFullName: fullname,
          userEmail: email,
          userIC: ic,
          userPhone: phone,
          userStatus: 'Active',
          userPassword: hashedPassword,
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

      // Step 2: Create practitioner linked to user
      const practitioner = await prisma.user_practitioners.create({
        data: {
          user: {
            connect: { userID: user.userID },
          },
          type: type,
          registration_no: registrationNo,
          specialty: specialty,
          department: department,
          qualifications: qualification,
          experience_years: experience,
          signature: signature,
          status: 'Active',
          created_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: "Practitioner added successfully",
        data: {
          user,
          practitioner,
        },
      };
  
    } catch (error) {
      console.error("Error inserting practitioner:", error);
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  
    