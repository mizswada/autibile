export default defineEventHandler(async (event) => {
  try {
    const session = await getVerifiedAdmin(event);
    if (!session.ok) {
      return { statusCode: session.statusCode, message: session.message };
    }

    const userID = parseInt(getQuery(event).userID, 10);
    if (!Number.isInteger(userID) || userID <= 0) {
      return { statusCode: 400, message: "A valid userID is required." };
    }

    const plan = await collectDeletionPlan(prisma, userID);
    if (!plan) {
      return { statusCode: 404, message: "User not found." };
    }

    return {
      statusCode: 200,
      message: "OK",
      data: buildPreview(plan, session.admin.userID),
    };
  } catch (error) {
    console.error("hardDelete preview error:", error);
    return { statusCode: 500, message: "Could not prepare the deletion preview." };
  }
});
