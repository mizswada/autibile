// Added by: Claude AI 
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

    // Delete the relation between parent and child
    const result = await prisma.user_parent_patient.deleteMany({
      where: { 
        patient_id: childId,
        parent_id: parentId
      },
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