/**
 * Central login check for the web API.
 *
 * The auth middleware (auth.js) only fills event.context.user; it never rejects a request,
 * so an endpoint without its own check was open to anyone on the internet. This guard runs
 * right after it and closes the biggest holes in one place:
 *
 *  - /api/devtool/** (file writes, raw SQL, DROP TABLE) needs an administrator.
 *  - Every other write (POST / PUT / PATCH / DELETE) needs a logged-in user, and writes in the
 *    administrator-only areas (users, practitioners, FAQ, community, ...) need an administrator.
 *
 * Left alone on purpose: /api/auth (login, reset), /api/public (account requests), /api/apps
 * (mobile app, which sends no web cookie) and /api/lookup (read-only lists the app uses).
 * Read endpoints with sensitive data carry their own check.
 */
const OPEN_PREFIXES = ["/api/auth/", "/api/public/", "/api/apps/", "/api/lookup/"];

// Areas whose pages are administrator-only (see middleware/role.js): doctors may read what they
// need elsewhere, but only an administrator may change anything here.
const ADMIN_WRITE_PREFIXES = [
  "/api/practitioners/",
  "/api/userApproval/",
  "/api/faq/",
  "/api/autismCentre/",
  "/api/communitySupport/",
  "/api/techSupport/",
  "/api/therapyService/",
  "/api/parents/",
  "/api/admin/",
  // Questionnaire authoring (create / edit / delete). Submitting and scoring stay open to doctors.
  "/api/questionnaire/delete",
  "/api/questionnaire/insert",
  "/api/questionnaire/update",
  "/api/questionnaire/questions/",
];

export default defineEventHandler((event) => {
  const path = String(event.path || event.node.req.url || "").split("?")[0];
  if (!path.startsWith("/api/")) return;

  const method = String(event.method || event.node.req.method || "GET").toUpperCase();
  if (method === "OPTIONS" || method === "HEAD") return;
  if (OPEN_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

  const user = event.context.user || {};

  if (path.startsWith("/api/devtool/")) {
    if (!user.userID) {
      return { statusCode: 401, success: false, message: "Unauthorized: please log in." };
    }
    const isAdmin = (user.roles || []).some((role) => String(role).includes("Admin"));
    if (!isAdmin) {
      return { statusCode: 403, success: false, message: "Forbidden: admin access only." };
    }
    return;
  }

  if (method !== "GET" && !user.userID) {
    return { statusCode: 401, success: false, message: "Unauthorized: please log in." };
  }

  if (method !== "GET" && ADMIN_WRITE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const isAdmin = (user.roles || []).some((role) => String(role).includes("Admin"));
    if (!isAdmin) {
      return { statusCode: 403, success: false, message: "Forbidden: admin access only." };
    }
  }
});
