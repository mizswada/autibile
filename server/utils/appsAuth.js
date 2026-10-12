import jwt from "jsonwebtoken";
import { getParentAuthContext } from "~/server/utils/appsParentAuth";
import { activeParentWhere } from "~/server/utils/activeEntities";

const ENV = useRuntimeConfig();

/**
 * Login check for mobile-app endpoints that change data.
 *
 * Builds of the app that are already installed send NO token to these endpoints, so they
 * cannot be locked down in one step. The check therefore has two modes, switched by the
 * app_settings row ENFORCE_APP_AUTH:
 *
 *   not '1' (default) - a valid token is verified and the caller is limited to their own
 *                       records; a request with no / bad token is still let through.
 *   '1'               - a valid token is required. Switch it on once the app version that
 *                       sends tokens (and the ownership checks) is in use.
 */
export const ENFORCE_APP_AUTH_KEY = "ENFORCE_APP_AUTH";

const CACHE_MS = 30 * 1000;
let enforcedCache = { value: false, expires: 0 };

async function isEnforced() {
  if (enforcedCache.expires > Date.now()) return enforcedCache.value;
  const row = await prisma.app_settings.findUnique({ where: { setting_key: ENFORCE_APP_AUTH_KEY } });
  enforcedCache = { value: String(row?.setting_value || "") === "1", expires: Date.now() + CACHE_MS };
  return enforcedCache.value;
}

function getBearerToken(event) {
  const header = event.req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.substring(7) : null;
}

const isAdminRole = (roles) => roles.some((role) => String(role).includes("Admin"));

// The mobile logins put "Doctor" / "Therapist" in the token (the web login uses "Practitioners").
const PRACTITIONER_ROLES = ["Doctor", "Therapist", "Practitioners"];
const hasPractitionerRole = (roles) => roles.some((role) => PRACTITIONER_ROLES.includes(role));

/**
 * Is the account behind a mobile token still allowed to use the app? Used when a refresh token
 * asks for a new access token, so a deactivated account stops working at the next refresh
 * instead of when its (up to 30 day) refresh token expires.
 */
export async function isAppAccountActive({ username, roles = [] }) {
  const user = await prisma.user.findFirst({
    where: { userUsername: username, userStatus: "Active" },
    select: { userID: true },
  });
  if (!user) return false;

  if (roles.includes("Parents")) {
    const parent = await prisma.user_parents.findFirst({
      where: { user_id: user.userID, ...activeParentWhere() },
      select: { parent_id: true },
    });
    return !!parent;
  }

  const types = ["Doctor", "Therapist"].filter((type) => roles.includes(type));
  if (types.length) {
    const practitioner = await prisma.user_practitioners.findFirst({
      where: { user_id: user.userID, type: { in: types }, deleted_at: null, status: "Active" },
      select: { practitioner_id: true },
    });
    return !!practitioner;
  }

  return isAdminRole(roles);
}

async function anonymous() {
  if (await isEnforced()) {
    return { ok: false, statusCode: 401, message: "Unauthorized: please log in again." };
  }
  return { ok: true, authenticated: false };
}

/**
 * @param {object} options
 * @param {"Parents"|"Practitioners"|"Any"} options.role who may call the endpoint
 * @returns {Promise<
 *   | { ok: false, statusCode: number, message: string }
 *   | { ok: true, authenticated: false }
 *   | { ok: true, authenticated: true, isAdmin: boolean, parentId?: number, patientIds?: number[], practitionerIds?: number[] }
 * >}
 */
export async function getAppAuth(event, { role }) {
  const token = getBearerToken(event);
  if (!token) return anonymous();

  let payload;
  try {
    payload = jwt.verify(token, ENV.auth.secretAccess);
  } catch (error) {
    return anonymous();
  }
  const roles = payload?.roles || [];
  // "Any" = parent app or practitioner app, whichever the token belongs to.
  if (role === "Any") role = roles.includes("Parents") ? "Parents" : "Practitioners";

  if (role === "Parents") {
    if (!roles.includes("Parents")) {
      return { ok: false, statusCode: 403, message: "Forbidden: parent account required" };
    }
    const parent = await getParentAuthContext(event);
    if (!parent.ok) return parent;
    return { ok: true, authenticated: true, isAdmin: false, parentId: parent.parentId, patientIds: parent.patientIds };
  }

  const isAdmin = isAdminRole(roles);
  if (!isAdmin && !hasPractitionerRole(roles)) {
    return { ok: false, statusCode: 403, message: "Forbidden: practitioner account required" };
  }

  const user = await prisma.user.findFirst({
    where: { userUsername: payload.username, userStatus: "Active" },
    select: { userID: true },
  });
  if (!user) return { ok: false, statusCode: 401, message: "Unauthorized: account is not active" };

  const records = await prisma.user_practitioners.findMany({
    where: { user_id: user.userID, deleted_at: null, status: "Active" },
    select: { practitioner_id: true },
  });
  if (!isAdmin && !records.length) {
    return { ok: false, statusCode: 403, message: "Forbidden: practitioner account is not active" };
  }

  return {
    ok: true,
    authenticated: true,
    isAdmin,
    practitionerIds: records.map((record) => record.practitioner_id),
  };
}

/** True when an authenticated practitioner may act on an appointment assigned to `practitionerId`. */
export function practitionerOwns(auth, practitionerId) {
  if (!auth.authenticated || auth.isAdmin) return true;
  return practitionerId != null && auth.practitionerIds.includes(practitionerId);
}
