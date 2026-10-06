import jwt from "jsonwebtoken";
import sha256 from "crypto-js/sha256.js";
import { timingSafeEqual } from "node:crypto";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

// adminUserID -> { failures: number[] (timestamps), lockedUntil: number }
const attemptState = new Map();

let hardDeleteRunning = false;

function fail(statusCode, message) {
  return { ok: false, statusCode, message };
}

/**
 * Identifies the logged-in admin from the signed accessToken cookie and the
 * database. Deliberately independent of server/middleware/auth.js, which needs
 * a cookie nothing sets and can resolve the wrong user after a token refresh.
 */
export async function getVerifiedAdmin(event) {
  const token = getCookie(event, "accessToken");
  if (!token) return fail(401, "Please log in again.");

  let payload;
  try {
    payload = jwt.verify(token, useRuntimeConfig().auth.secretAccess);
  } catch {
    return fail(401, "Your session has expired. Please log in again.");
  }

  const username = payload?.username;
  if (!username) return fail(401, "Please log in again.");

  // Usernames are not unique, so require exactly one active admin match.
  const candidates = await prisma.user.findMany({
    where: {
      userUsername: username,
      userrole: { some: { role: { roleName: { contains: "Admin" } } } },
    },
    select: { userID: true, userFullName: true, userEmail: true, userStatus: true },
  });
  const active = candidates.filter(
    (u) => String(u.userStatus || "").toLowerCase() === "active",
  );
  if (active.length !== 1) {
    return fail(403, "Could not verify your administrator account.");
  }

  return {
    ok: true,
    admin: {
      userID: active[0].userID,
      name: active[0].userFullName,
      email: active[0].userEmail,
    },
  };
}

function lockRemainingMs(adminUserID) {
  const state = attemptState.get(adminUserID);
  if (!state || !state.lockedUntil) return 0;
  return Math.max(0, state.lockedUntil - Date.now());
}

function recordFailure(adminUserID) {
  const now = Date.now();
  const state = attemptState.get(adminUserID) || { failures: [], lockedUntil: 0 };
  state.failures = state.failures.filter((t) => now - t < WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = now + LOCK_MS;
    state.failures = [];
  }
  attemptState.set(adminUserID, state);
  return state;
}

/** Re-checks the acting admin's own email and password (with attempt lockout). */
export async function verifyAdminCredentials(adminUserID, email, password) {
  const lockedFor = lockRemainingMs(adminUserID);
  if (lockedFor > 0) {
    const minutes = Math.ceil(lockedFor / 60000);
    return fail(429, `Too many failed attempts. Try again in ${minutes} minute(s).`);
  }

  if (!email || !password) {
    return fail(400, "Enter your admin email and password.");
  }

  const admin = await prisma.user.findUnique({
    where: { userID: adminUserID },
    select: { userEmail: true, userPassword: true },
  });

  const emailMatches =
    !!admin?.userEmail &&
    String(email).trim().toLowerCase() === String(admin.userEmail).trim().toLowerCase();

  const given = Buffer.from(sha256(String(password)).toString());
  const stored = Buffer.from(String(admin?.userPassword || ""));
  const passwordMatches =
    given.length === stored.length && stored.length > 0 && timingSafeEqual(given, stored);

  if (!emailMatches || !passwordMatches) {
    const state = recordFailure(adminUserID);
    if (state.lockedUntil > Date.now()) {
      return fail(429, "Too many failed attempts. Try again in 15 minute(s).");
    }
    return fail(401, "Email or password is incorrect.");
  }

  attemptState.delete(adminUserID);
  return { ok: true };
}

/** Only one hard delete may run at a time. Returns a release function or null. */
export function acquireHardDeleteLock() {
  if (hardDeleteRunning) return null;
  hardDeleteRunning = true;
  return () => {
    hardDeleteRunning = false;
  };
}

// ---------------------------------------------------------------------------
// AI Settings unlock: a short-lived, admin-bound cookie obtained by re-entering
// the admin's own email and password. Saving or testing the settings needs it.
// ---------------------------------------------------------------------------
const UNLOCK_COOKIE = "aiSettingsUnlock";
const UNLOCK_TTL_SECONDS = 15 * 60;
const UNLOCK_PATH = "/api/apps/settings";

function unlockSecret() {
  // Separate secret so an unlock token can never be mistaken for a login token.
  return `${useRuntimeConfig().auth.secretAccess}:ai-settings-unlock`;
}

export function issueSettingsUnlock(event, adminUserID) {
  const token = jwt.sign({ purpose: "ai-settings-unlock", uid: adminUserID }, unlockSecret(), {
    expiresIn: UNLOCK_TTL_SECONDS,
  });
  setCookie(event, UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: UNLOCK_PATH,
    maxAge: UNLOCK_TTL_SECONDS,
  });
  return UNLOCK_TTL_SECONDS;
}

export function clearSettingsUnlock(event) {
  deleteCookie(event, UNLOCK_COOKIE, { path: UNLOCK_PATH });
}

export function hasSettingsUnlock(event, adminUserID) {
  const token = getCookie(event, UNLOCK_COOKIE);
  if (!token) return false;
  try {
    const payload = jwt.verify(token, unlockSecret());
    return payload?.purpose === "ai-settings-unlock" && payload.uid === adminUserID;
  } catch {
    return false;
  }
}

/** Logged-in admin required; with { unlocked: true } the unlock cookie is required too. */
export async function requireAiSettingsAccess(event, { unlocked = false } = {}) {
  const session = await getVerifiedAdmin(event);
  if (!session.ok) return session;
  if (unlocked && !hasSettingsUnlock(event, session.admin.userID)) {
    return fail(423, "AI settings are locked. Unlock them with your admin email and password.");
  }
  return session;
}
