/**
 * Slows down password guessing on the login endpoints (the global rate limiter is switched off
 * in nuxt.config). Counts failed attempts per IP and per IP + account for 15 minutes.
 *
 * It lives in each server process's memory (pm2 runs several), so the real limit is a few
 * times higher than the numbers below; that is still enough to make guessing impractical.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 60;

const failures = new Map();

function clientIp(event) {
  const forwarded = event.node.req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return event.node.req.socket?.remoteAddress || "unknown";
}

function prune(now) {
  if (failures.size < 5000) return;
  for (const [key, entry] of failures) {
    if (now - entry.first > WINDOW_MS) failures.delete(key);
  }
}

function current(key, now) {
  const entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS) return null;
  return entry;
}

/** { ipKey, accountKey } for one login request. */
export function loginKeys(event, username) {
  const ip = clientIp(event);
  return { ipKey: `ip:${ip}`, accountKey: `acct:${ip}:${String(username || "").trim().toLowerCase()}` };
}

export function isLoginBlocked(keys) {
  const now = Date.now();
  return (
    (current(keys.accountKey, now)?.count || 0) >= MAX_PER_ACCOUNT ||
    (current(keys.ipKey, now)?.count || 0) >= MAX_PER_IP
  );
}

export function recordLoginFailure(keys) {
  const now = Date.now();
  prune(now);
  for (const key of [keys.accountKey, keys.ipKey]) {
    const entry = current(key, now);
    if (entry) entry.count += 1;
    else failures.set(key, { count: 1, first: now });
  }
}

/** A correct password clears the account counter (the IP counter keeps counting). */
export function clearLoginFailures(keys) {
  failures.delete(keys.accountKey);
}

export const LOGIN_BLOCKED_MESSAGE = "Too many failed attempts. Please wait 15 minutes and try again.";
