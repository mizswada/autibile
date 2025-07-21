import sha256 from "crypto-js/sha256.js";

export default defineEventHandler(async (event) => {
    try {  
      const body = await readBody(event);

      const { 
        username,
        fullname,
        email,
        ic,
        phone,
        password,
        role,   
        type,
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
          userStatus: 'Pending',
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
          registration_no: '',
          specialty: '',
          department: '',
          qualifications: '',
          experience_years: null,
          signature: '',
          status: 'Pending',
          created_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: "Practitioner added successfully",
        userID: user.userID,
        practitionerID: practitioner.practitioner_id,
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
  
    