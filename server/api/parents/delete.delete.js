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

    const parent = await prisma.user_parents.findFirst({
      where: {
        parent_id: id,
        deleted_at: null,
      },
      select: {
        parent_id: true,
        user_id: true,
      },
    });

    if (!parent) {
      return {
        statusCode: 404,
        message: 'Parent not found or already deleted',
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Find all child IDs linked to this parent
      const links = await tx.user_parent_patient.findMany({
        where: { parent_id: id },
        select: { patient_id: true },
      });

      const childIDs = links.map((link) => link.patient_id);

      // 2. Soft delete children by setting deleted_at
      if (childIDs.length > 0) {
        const children = await tx.user_patients.findMany({
          where: {
            patient_id: { in: childIDs },
            deleted_at: null,
          },
          select: { user_id: true },
        });

        await tx.user_patients.updateMany({
          where: {
            patient_id: { in: childIDs },
            deleted_at: null,
          },
          data: {
            deleted_at: currentDate,
            status: 'Inactive',
          },
        });

        const childUserIDs = children
          .map((child) => child.user_id)
          .filter((userId) => userId != null);

        if (childUserIDs.length > 0) {
          await tx.user.updateMany({
            where: { userID: { in: childUserIDs } },
            data: {
              userStatus: 'Inactive',
              userModifiedDate: currentDate,
            },
          });
        }
      }

      // 3. Soft delete the parent
      await tx.user_parents.update({
        where: { parent_id: id },
        data: {
          deleted_at: currentDate,
          parent_status: 'Inactive',
        },
      });

      // 4. Deactivate linked login account
      if (parent.user_id) {
        await tx.user.update({
          where: { userID: parent.user_id },
          data: {
            userStatus: 'Inactive',
            userModifiedDate: currentDate,
          },
        });
      }

      // Keep user_parent_patient links for history / possible restore.
      // Lists and booking already ignore soft-deleted parents/children.
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
      error: error.message,
    };
  }
});
