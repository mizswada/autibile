// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  const { userID } = getQuery(event);

  if (!userID) {
    return {
      statusCode: 400,
      message: 'Missing user ID',
    };
  }

  try {
    const id = parseInt(userID);
    const currentDate = new Date();

    // Update user status to inactive
    await prisma.user.update({
      where: { 
        userID: id,
      },
      data: { 
        userStatus: 'INACTIVE',
        userModifiedDate: currentDate
      }
    });

    return {
      statusCode: 200,
      message: 'Administrator soft deleted successfully',
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 