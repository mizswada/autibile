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

    // Update only the status field in user_practitioners table
    const updated = await prisma.user_practitioners.update({
      where: { practitioner_id: practitionerID },
      data: {
        status: status,
      },
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