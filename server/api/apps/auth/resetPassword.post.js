import sha256 from "crypto-js/sha256.js";
import jwt from "jsonwebtoken";
import { isAppAuthEnforced } from "~/server/utils/appsAuth";

const ENV = useRuntimeConfig();
const MIN_PASSWORD_LENGTH = 6;

/**
 * "Change password" screen of the mobile app (used, for example, right after an administrator
 * approved a reset request and the password became the temporary one).
 *
 * Installed builds of the app send NO login token here, so, like the other mobile endpoints, it
 * works without one until ENFORCE_APP_AUTH is switched on. When a token IS sent (newer builds),
 * the e-mail must belong to that same account.
 */
export default defineEventHandler(async (event) => {
  const header = event.req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.substring(7) : null;

  let payload = null;
  if (token) {
    try {
      payload = jwt.verify(token, ENV.auth.secretAccess);
    } catch (error) {
      payload = null;
    }
  }
  if (!payload && (await isAppAuthEnforced())) {
    return { status: 401, message: "Please sign in again to change your password." };
  }

  const body = await readBody(event);
  const { email, password, confirmPassword } = body || {};

  if (!email || !password || !confirmPassword) {
    return { status: 400, message: "All fields are required." };
  }

  if (password !== confirmPassword) {
    return { status: 400, message: "Passwords do not match." };
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return { status: 400, message: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const user = await prisma.user.findFirst({ where: { userEmail: String(email).trim() } });

  if (!user) {
    return { status: 404, message: "User not found." };
  }

  // A signed-in caller can only change their own password.
  if (payload && user.userUsername !== payload.username) {
    return { status: 403, message: "You can only change the password of your own account." };
  }

  await prisma.user.update({
    where: { userID: user.userID },
    data: { userPassword: sha256(password).toString(), userModifiedDate: new Date() },
  });

  return { status: 200, message: "Password reset successful." };
});
