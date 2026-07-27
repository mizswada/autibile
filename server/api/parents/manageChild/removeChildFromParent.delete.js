// Added by: Claude AI 
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const { childID, parentID } = getQuery(event);

  if (!childID || !parentID) {
    return {
      statusCode: 400,
      message: 'Missing child ID or parent ID',
    };
  }

  try {
    const childId = parseInt(childID);
    const parentId = parseInt(parentID);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Delete the relation between parent and child
      const deleted = await tx.user_parent_patient.deleteMany({
        where: { 
          patient_id: childId,
          parent_id: parentId
        },
      });

      if (deleted.count === 0) {
        return { count: 0 };
      }

      // If child has no remaining parent links, deactivate them
      const remainingLinks = await tx.user_parent_patient.count({
        where: { patient_id: childId },
      });

      if (remainingLinks === 0) {
        const child = await tx.user_patients.findFirst({
          where: {
            patient_id: childId,
            deleted_at: null,
          },
          select: { user_id: true },
        });

        if (child) {
          await tx.user_patients.update({
            where: { patient_id: childId },
            data: {
              status: 'Inactive',
              update_at: now,
            },
          });

          if (child.user_id) {
            await tx.user.update({
              where: { userID: child.user_id },
              data: {
                userStatus: 'Inactive',
                userModifiedDate: now,
              },
            });
          }
        }
      }

      return deleted;
    });

    if (result.count === 0) {
      return {
        statusCode: 404,
        message: 'No relationship found between this parent and child',
      };
    }

    return {
      statusCode: 200,
      message: 'Child removed from parent successfully',
    };
  } catch (error) {
    console.error('Remove child association error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  }
});
