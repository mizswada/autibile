// Added by: Firzana Huda 
export default defineEventHandler(async (event) => {
  const { childID } = getQuery(event);

  if (!childID) {
    return { statusCode: 400, message: 'Missing child ID' };
  }

  try {
    // Find the parent-child relationship
    const parentChild = await prisma.user_parent_patient.findFirst({
      where: { patient_id: parseInt(childID) },
    });

    if (!parentChild) {
      return {
        statusCode: 404,
        message: 'No parent found for this child',
      };
    }

    return {
      statusCode: 200,
      message: 'Success',
      data: parentChild,
    };
  } catch (error) {
    console.error('Error fetching parent by child:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
}); 