export default defineEventHandler(async (event) => {
  const session = await getVerifiedAdmin(event);
  if (!session.ok) {
    return { statusCode: session.statusCode, message: session.message };
  }
  clearSettingsUnlock(event);
  return { statusCode: 200, message: "AI settings locked." };
});
