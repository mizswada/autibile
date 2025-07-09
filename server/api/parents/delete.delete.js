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
    const currentDate = new Date();

    // 1. Find all child IDs linked to this parent
    const links = await prisma.user_parent_patient.findMany({
      where: { parent_id: id },
      select: { patient_id: true },
    });

    const childIDs = links.map(link => link.patient_id);

    // 2. Soft delete children by setting deleted_at
    if (childIDs.length > 0) {
      await prisma.user_patients.updateMany({
        where: { 
          patient_id: { in: childIDs },
          deleted_at: null // Only update records that haven't been deleted yet
        },
        data: { 
          deleted_at: currentDate,
          status: 'INACTIVE'
        }
      });
    }

    // 3. Soft delete the parent
    await prisma.user_parents.update({
      where: { 
        parent_id: id,
        deleted_at: null // Only update if not already deleted
      },
      data: { 
        deleted_at: currentDate,
        parent_status: 'INACTIVE'
      }
    });

    // 4. Delete the relationships in user_parent_patient
    await prisma.user_parent_patient.deleteMany({
      where: { parent_id: id }
    });

    return {
      statusCode: 200,
      message: 'Parent and all related children soft deleted successfully',
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
