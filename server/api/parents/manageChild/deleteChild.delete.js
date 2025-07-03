// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  const { childID } = getQuery(event);

  if (!childID) {
    return {
      statusCode: 400,
      message: 'Missing child ID',
    };
  }

  try {
    const id = parseInt(childID);

    // Step 1: Delete relation (if exists)
    await prisma.user_parent_patient.deleteMany({
      where: { patient_id: id },
    });

    // Step 2: Delete patient
    await prisma.user_patients.delete({
      where: { patient_id: id },
    });

    return {
      statusCode: 200,
      message: 'Child deleted successfully',
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
});
