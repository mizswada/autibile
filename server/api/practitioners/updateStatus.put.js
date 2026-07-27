// Added by: Firzana Huda
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { practitionerID, status } = body;

    if (!practitionerID) {
      return {
        statusCode: 400,
        message: 'Missing practitioner ID',
      };
    }

    if (!status || !['Active', 'Inactive'].includes(status)) {
      return {
        statusCode: 400,
        message: 'Invalid status value. Must be either "Active" or "Inactive"',
      };
    }

    const practitioner = await prisma.user_practitioners.findUnique({
      where: { practitioner_id: practitionerID },
      select: { user_id: true },
    });

    if (!practitioner) {
      return {
        statusCode: 404,
        message: 'Practitioner not found',
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const practitionerUpdate = await tx.user_practitioners.update({
        where: { practitioner_id: practitionerID },
        data: {
          status: status,
        },
      });

      if (practitioner.user_id) {
        await tx.user.update({
          where: { userID: practitioner.user_id },
          data: {
            userStatus: status,
            userModifiedDate: new Date(),
          },
        });
      }

      return practitionerUpdate;
    });

    return {
      statusCode: 200,
      message: `Practitioner status updated to ${status}`,
      data: updated,
    };
  } catch (error) {
    console.error('Status update failed:', error);
    return {
      statusCode: 500,
      message: `Internal server error: ${error.message}`,
    };
  }
}); 