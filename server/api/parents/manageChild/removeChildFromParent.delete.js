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

    // Delete only the relation between parent and child
    await prisma.user_parent_patient.deleteMany({
      where: { 
        patient_id: childId,
        parent_id: parentId
      },
    });

    return {
      statusCode: 200,
      message: 'Child removed from parent successfully',
    };
  } catch (error) {
    console.error('Remove child association error:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
}); 