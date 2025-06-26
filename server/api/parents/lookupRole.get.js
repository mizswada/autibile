// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    try {
      const { userID } = event.context.user;
  
      if (!userID) {
        return {
          statusCode: 401,
          message: 'Unauthorized',
        };
      }
  
      const validatedUser = await prisma.user.findFirst({
        where: { userID: parseInt(userID) },
      });
  
      if (!validatedUser) {
        return {
          statusCode: 401,
          message: 'Unauthorized',
        };
      }
  
      // Fetch role values from the 'role' table
      const role = await prisma.role.findMany({
        select: {
          roleID: true,
          roleName: true,
        },
      });
  
      return role; 
    } catch (error) {
      console.error('Role fetch error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
      };
    }
  });
    
    