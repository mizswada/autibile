import jwt from "jsonwebtoken";

const ENV = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let refreshToken = body?.refreshToken;

    if (!refreshToken && event.req.headers.cookie) {
      const match = event.req.headers.cookie.match(/refreshToken=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    if (!refreshToken) {
      return {
        statusCode: 401,
        message: "Unauthorized: No refresh token provided",
      };
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, ENV.auth.secretRefresh);
    } catch (err) {
      return {
        statusCode: 401,
        message: "Unauthorized: Invalid or expired refresh token",
      };
    }

    const accessToken = jwt.sign(
      {
        username: payload.username,
        roles: payload.roles || [],
      },
      ENV.auth.secretAccess,
      { expiresIn: "1d" },
    );

    event.res.setHeader("Set-Cookie", [
      `accessToken=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
    ]);

    return {
      statusCode: 200,
      message: "Token refreshed",
      data: {
        accessToken,
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
