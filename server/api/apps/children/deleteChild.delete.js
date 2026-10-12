import { getAppAuth } from "~/server/utils/appsAuth";

export default defineEventHandler(async (event) => {
  const auth = await getAppAuth(event, { role: "Parents" });
  if (!auth.ok) {
    return { statusCode: auth.statusCode, message: auth.message };
  }

  const body = await readBody(event);
  
  const { childID, parentID } = body;

  if (!childID || !parentID) {
    return {
      statusCode: 400,
      message: 'Missing child ID or parent ID',
    };
  }

  try {
    const childId = parseInt(childID);
    const parentId = parseInt(parentID);

    // A signed-in parent can only remove a child from their own account.
    if (auth.authenticated && parentId !== auth.parentId) {
      return { statusCode: 403, message: 'Forbidden: this is not your account' };
    }

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