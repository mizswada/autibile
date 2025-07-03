// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  const { parentID } = getQuery(event);

  if (!parentID) {
    return {
      statusCode: 400,
      message: 'Missing parent ID',
    };
  }

  try {
    const id = parseInt(parentID);

    // 1. Find all child IDs linked to this parent
    const links = await prisma.user_parent_patient.findMany({
      where: { parent_id: id },
      select: { patient_id: true },
    });

    const childIDs = links.map(link => link.patient_id);

    // 2. Delete links from user_parent_patient
    await prisma.user_parent_patient.deleteMany({
      where: { parent_id: id },
    });

    // 3. Delete actual child data from user_patients
    if (childIDs.length > 0) {
      await prisma.user_patients.deleteMany({
        where: { patient_id: { in: childIDs } },
      });
    }

    // 4. Delete the parent
    await prisma.user_parents.delete({
      where: { parent_id: id },
    });

    return {
      statusCode: 200,
      message: 'Parent and all related children deleted successfully',
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
});
