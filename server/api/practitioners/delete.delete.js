// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  const { practitionerID } = getQuery(event);

  if (!practitionerID) {
    return {
      statusCode: 400,
      message: 'Missing practitioner ID',
    };
  }

  try {
    const id = parseInt(practitionerID);
    const currentDate = new Date();

    const practitioner = await prisma.user_practitioners.findFirst({
      where: {
        practitioner_id: id,
        deleted_at: null,
      },
      select: {
        practitioner_id: true,
        user_id: true,
      },
    });

    if (!practitioner) {
      return {
        statusCode: 404,
        message: 'Practitioner not found or already deleted',
      };
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete by setting deleted_at
      await tx.user_practitioners.update({
        where: { practitioner_id: id },
        data: {
          deleted_at: currentDate,
          status: 'Inactive',
        },
      });

      // Deactivate linked login account
      if (practitioner.user_id) {
        await tx.user.update({
          where: { userID: practitioner.user_id },
          data: {
            userStatus: 'Inactive',
            userModifiedDate: currentDate,
          },
        });
      }
    });

    return {
      statusCode: 200,
      message: 'Practitioner soft deleted successfully',
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message,
    };
  }
});
