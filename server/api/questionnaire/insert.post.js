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
        title,
        description,
        status,
      } = body;
  
      // Basic validation
      if (
          !title || !description || !status
        ) {
          return {
            statusCode: 400,
            message: "Missing required fields",
          };
        }

      // Save to DB
      const saved = await prisma.questionnaires.create({
        data: {
          title: title,
          description: description,
          status: status,
          created_at: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: "Questionnaire added successfully",
        data: saved,
      };
  
    } catch (error) {
      console.error("Error inserting questionnaire:", error);
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  
    