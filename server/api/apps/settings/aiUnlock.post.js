export default defineEventHandler(async (event) => {
  try {
    const session = await getVerifiedAdmin(event);
    if (!session.ok) {
      return { statusCode: session.statusCode, message: session.message };
    }

    const body = (await readBody(event)) || {};
    const credentials = await verifyAdminCredentials(
      session.admin.userID,
      body.adminEmail,
      body.adminPassword,
    );
    if (!credentials.ok) {
      return { statusCode: credentials.statusCode, message: credentials.message };
    }

    const expiresInSeconds = issueSettingsUnlock(event, session.admin.userID);
    return { statusCode: 200, message: "AI settings unlocked.", data: { expiresInSeconds } };
  } catch (error) {
    console.error("aiUnlock error:", error);
    return { statusCode: 500, message: "Could not unlock the AI settings." };
  }
});
