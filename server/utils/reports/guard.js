/**
 * Admin-only guard for report endpoints. Returns { ok } or an error descriptor.
 * event.context.user is populated by server/middleware/auth.js.
 */
export function requireAdmin(event) {
  const user = event.context.user || {};
  if (!user.userID) {
    return { ok: false, statusCode: 401, message: "Unauthorized: please log in." };
  }
  const roles = user.roles || [];
  const isAdmin = roles.some((r) => String(r).includes("Admin"));
  if (!isAdmin) {
    return { ok: false, statusCode: 403, message: "Forbidden: admin access only." };
  }
  return { ok: true };
}
