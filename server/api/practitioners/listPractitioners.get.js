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
  
      const practitioners = await prisma.user_practitioners.findMany({
        orderBy: { created_at: 'desc' },
        select: {
          practitioner_id: true,
          type: true,
          registration_no: true,
          specialty: true,
          department: true,
          qualifications: true,
          experience_years: true,
          signature: true,
        }
      });
  
      return {
        statusCode: 200,
        message: 'Success',
        data: practitioners,
      };
  
    } catch (error) {
        console.error('GET /api/practitioners/listPractitioners error:', error);
        return {
          statusCode: 500,
          message: 'Internal Server Error',
        };
      }
  });
    