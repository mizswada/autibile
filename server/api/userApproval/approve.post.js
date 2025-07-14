export default defineEventHandler(async (event) => {
    try {
      const body = await readBody(event);
      const { practitionerID } = body;
  
      if (!practitionerID) {
        return {
          statusCode: 400,
          message: 'Practitioner ID is required',
        };
      }
  
      const updatedPractitioner = await prisma.user_practitioners.update({
        where: { practitioner_id: practitionerID },
        data: { status: 'Active' },
      });
  
      return {
        statusCode: 200,
        message: 'Practitioner approved successfully',
        data: updatedPractitioner,
      };
    } catch (error) {
      console.error('POST /api/userApproval/approve error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message,
      };
    }
  });
  