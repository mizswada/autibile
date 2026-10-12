import sha256 from "crypto-js/sha256.js";
import jwt from "jsonwebtoken";

const ENV = useRuntimeConfig();
const MIN_PASSWORD_LENGTH = 6;

/**
 * Change the password of the signed-in mobile user (the "Change password" screen in the app).
 *
 * This used to set the password of ANY account from just an e-mail address, with no login at
 * all. It now needs the caller's access token, and the e-mail must belong to that same account.
 */
export default defineEventHandler(async (event) => {
  const header = event.req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.substring(7) : null;
  if (!token) {
    return { status: 401, message: "Please sign in again (or update the app) to change your password." };
  }

  let payload;
  try {
    payload = jwt.verify(token, ENV.auth.secretAccess);
  } catch (error) {
    return { status: 401, message: "Your session has expired. Please sign in again." };
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

  // Only your own account, and only while it is active.
  if (
    !user ||
    user.userUsername !== payload.username ||
    String(user.userStatus || "").toLowerCase() !== "active"
  ) {
    return { status: 403, message: "You can only change the password of your own account." };
  }

  await prisma.user.update({
    where: { userID: user.userID },
    data: { userPassword: sha256(password).toString(), userModifiedDate: new Date() },
  });

  return { status: 200, message: "Password reset successful." };
});
