import sha256 from "crypto-js/sha256.js";
import jwt from "jsonwebtoken";
import {
  findPractitionerByEmail,
  getActivePractitioner,
  getPractitionerLoginError,
} from "~/server/utils/practitionerAuth";

const ENV = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  try {
    const { username, password, rememberMe } = await readBody(event);

    if (!username || !password) {
      return {
        statusCode: 400,
        message: "Username and password are required",
      };
    }

    // Look the account up by e-mail only. Every other condition is checked
    // below so the response can say what is actually wrong.
    const user = await findPractitionerByEmail(username);

   // console.log('user', user);

    if (!user) {
      return {
        statusCode: 404,
        message: "Doctor does not exist",
        data: null,
      };
    }

    // Verify password
    const hashedPassword = sha256(password).toString();
    if (user.userPassword !== hashedPassword) {
      return {
        statusCode: 401,
        message: "Invalid password",
      };
    }

    // Password is correct: safe to disclose why the account cannot be used.
    const loginError = getPractitionerLoginError(user, "Doctor");
    if (loginError) return loginError;

    const roleNames = ['Doctor'];

    // Pick the record matching this login type; user_practitioners[0] could be
    // a different practitioner type when a user holds more than one.
    const practitioner = getActivePractitioner(user, "Doctor");
    const practitionerId = practitioner ? practitioner.practitioner_id : null;
    const hasPractitionerInfo = !!(
      practitioner &&
      practitioner.registration_no !== null &&
      practitioner.registration_no !== ""
    );
    // Generate tokens with Doctor role
    const accessToken = generateAccessToken({
      username: user.userUsername,
      roles: roleNames,
    });

    const refreshToken = generateRefreshToken({
      username: user.userUsername,
      roles: roleNames,
    }, rememberMe);

    // Set HttpOnly cookies
    event.res.setHeader("Set-Cookie", [
      `accessToken=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
    ]);

    return {
      statusCode: 200,
      message: "Login success",
      data: {
        username: user.userFullName,
        roles: roleNames,
        userID: user.userID,
        practitionerId: practitionerId,
        hasPractitionerInfo: hasPractitionerInfo,
        accessToken: accessToken,
        refreshToken: refreshToken,
      },
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});

function generateAccessToken(user) {
  return jwt.sign(user, ENV.auth.secretAccess, { expiresIn: "1d" });
}

function generateRefreshToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? "30d" : "1d";
  return jwt.sign(user, ENV.auth.secretRefresh, { expiresIn: expiresIn });
}
