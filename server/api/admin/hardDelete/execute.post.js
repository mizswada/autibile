function clientIp(event) {
  const forwarded = event.node.req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return event.node.req.socket?.remoteAddress || null;
}

export default defineEventHandler(async (event) => {
  let release = null;
  try {
    const session = await getVerifiedAdmin(event);
    if (!session.ok) {
      return { statusCode: session.statusCode, message: session.message };
    }
    const admin = session.admin;

    const body = (await readBody(event)) || {};
    const userID = parseInt(body.userID, 10);
    if (!Number.isInteger(userID) || userID <= 0) {
      return { statusCode: 400, message: "A valid userID is required." };
    }

    // Cheap checks first, so a wrong sentence never burns a password attempt.
    if (body.acknowledge !== true) {
      return { statusCode: 400, message: "You must acknowledge that the data will be permanently erased." };
    }
    if (String(body.confirmPhrase || "").trim() !== HARD_DELETE_PHRASE) {
      return { statusCode: 400, message: "The confirmation sentence does not match exactly." };
    }

    const plan = await collectDeletionPlan(prisma, userID);
    if (!plan) {
      return { statusCode: 404, message: "User not found." };
    }

    const blockers = getBlockers(plan, admin.userID);
    if (blockers.length) {
      return { statusCode: 409, message: blockers[0] };
    }

    const expected = getConfirmIdentifier(plan.user).trim().toLowerCase();
    if (String(body.confirmIdentifier || "").trim().toLowerCase() !== expected) {
      return { statusCode: 400, message: "The typed account email/username does not match." };
    }

    const credentials = await verifyAdminCredentials(
      admin.userID,
      body.adminEmail,
      body.adminPassword,
    );
    if (!credentials.ok) {
      return { statusCode: credentials.statusCode, message: credentials.message };
    }

    release = acquireHardDeleteLock();
    if (!release) {
      return { statusCode: 423, message: "Another permanent deletion is in progress. Try again in a moment." };
    }

    const counts = await executeHardDelete(prisma, {
      userID,
      admin,
      ip: clientIp(event),
    });

    console.log(
      `[hardDelete] admin ${admin.userID} permanently deleted user ${userID} (${plan.user.userEmail || plan.user.userUsername})`,
    );

    return {
      statusCode: 200,
      message: "The account and all connected data were permanently deleted.",
      data: { counts },
    };
  } catch (error) {
    console.error("hardDelete execute error:", error);
    return {
      statusCode: 500,
      message: "The deletion failed and nothing was deleted. " + (error?.message || ""),
    };
  } finally {
    if (release) release();
  }
});
