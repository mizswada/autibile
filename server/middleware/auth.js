import jwt from "jsonwebtoken";

const ENV = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  try {
    const cookies = event.req.headers.cookie;
    if (!cookies) throw new Error("Cookie not found");

    let { accessToken, refreshToken, user } = parseCookie(cookies);

    if (!accessToken) accessToken = null;
    if (!refreshToken) refreshToken = null;

    let { subdomain } = JSON.parse(user);
    if (!subdomain) subdomain = null;

    let payloadUser = null;
    let refreshed = false;

    payloadUser = verifyAccessToken(accessToken);

    if (!payloadUser) {
      payloadUser = verifyRefreshToken(refreshToken);
      if (!payloadUser) throw new Error("Unauthorized Refresh Token");

      refreshed = true;
    }

    const getUser = await getUserInfo(payloadUser.username);
    if (!getUser) throw new Error("User not found");

    // Roles and account status come from the database, not from the token: a deactivated
    // or demoted account loses access within a minute instead of when its token expires
    // (refresh tokens last up to 30 days).
    const access = await getCurrentAccess(getUser);
    if (!access) throw new Error("Account is not active");

    if (refreshed) {
      const accessToken = generateAccessToken({
        username: payloadUser.username,
        email: payloadUser.email,
        roles: access.roles,
      });

      // Set new access token
      event.res.setHeader("Set-Cookie", [
        `accessToken=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
      ]);
    }

    event.context.user = {
      userID: getUser.userID || null,
      email: payloadUser.email || null,
      roles: access.roles,
    };

    return;
  } catch (error) {
    // console.log(error.message);
    event.context.user = {
      userID: null,
      email: null,
      roles: [],
    };
    return;
  }
});

function parseCookie(str) {
  return str
    .split(";")
    .map((v) => v.split("="))
    .reduce((acc, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      return acc;
    }, {});
}

function verifyAccessToken(accessToken) {
  try {
    const token = ENV.auth.secretAccess;
    return jwt.verify(accessToken, token);
  } catch (error) {
    return false;
  }
}

function verifyRefreshToken(refreshToken) {
  try {
    const token = ENV.auth.secretRefresh;
    return jwt.verify(refreshToken, token);
  } catch (error) {
    return false;
  }
}

function generateAccessToken(user) {
  try {
    const token = ENV.auth.secretAccess;
    return jwt.sign(user, token, { expiresIn: "1d" });
  } catch (error) {
    return false;
  }
}

// Roles / status are re-read at most every 30 seconds per server process, so a normal page
// load does not repeat three queries for every request.
const ACCESS_CACHE_MS = 30 * 1000;
const accessCache = new Map();

/**
 * Current roles of the account, or null when it may not use the web app any more. Same rule as
 * the login: an active account that is an administrator or an active doctor.
 */
async function getCurrentAccess(user) {
  const cached = accessCache.get(user.userID);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value = null;
  if (String(user.userStatus || "").toLowerCase() === "active") {
    const rows = await prisma.userrole.findMany({
      where: { userRoleUserID: user.userID },
      select: { role: { select: { roleName: true } } },
    });
    const roles = rows.map((row) => row.role.roleName);
    const isAdmin = roles.some((role) => role.includes("Admin"));

    let allowed = isAdmin;
    if (!allowed && roles.some((role) => role === "Practitioners")) {
      const doctor = await prisma.user_practitioners.findFirst({
        where: { user_id: user.userID, type: "Doctor", status: "Active" },
        select: { practitioner_id: true },
      });
      allowed = !!doctor;
    }
    value = allowed ? { roles } : null;
  }

  accessCache.set(user.userID, { value, expires: Date.now() + ACCESS_CACHE_MS });
  return value;
}

async function getUserInfo(username) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        userUsername: username,
      },
    });

    if (!user) return null;

    return user;
  } catch (error) {
    console.log(error);
  }
}
