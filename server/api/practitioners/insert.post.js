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

      console.log('[Insert] Received body:', body);
      console.log('[Insert] Signature (first 100 chars):', body.signature?.substring(0, 100));
  
      const {    
        type,
        registrationNo,
        specialty,
        department,
        qualification,
        experience,
        signature,
      } = body;
  
      // Basic validation
      if (
          !type || !registrationNo || !specialty || !department ||
          !qualification || !experience
        ) {
          return {
            statusCode: 400,
            message: "Missing required fields",
          };
        }

      // Save to DB
      const saved = await prisma.user_practitioners.create({
        data: {
          user_id: parseInt(userID),
          type: type,
          registration_no: registrationNo,
          specialty: specialty,
          department: department,
          qualifications: qualification,
          experience_years: experience,
          signature: signature,
          created_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: "Practitioner added successfully",
        data: saved,
      };
  
    } catch (error) {
      console.error("Error inserting practitioner:", error);
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  
    