import jwt from "jsonwebtoken";

const ENV = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  try {
    let accessToken;

    // For GET: read from Authorization header
    if (event.req.method === "GET" && event.req.headers.authorization) {
      const authHeader = event.req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        accessToken = authHeader.substring(7);
      }
    }

    // For non-GET: read from body
    if (!accessToken && event.req.method !== "GET") {
      const body = await readBody(event);
      accessToken = body.accessToken;
    }

    // Fallback: cookie
    if (!accessToken && event.req.headers.cookie) {
      const match = event.req.headers.cookie.match(/accessToken=([^;]+)/);
      if (match) accessToken = match[1];
    }

    if (!accessToken) {
      return {
        statusCode: 401,
        message: "Unauthorized: No access token provided",
      };
    }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(accessToken, ENV.auth.secretAccess);
    } catch (err) {
      return {
        statusCode: 401,
        message: "Unauthorized: Invalid or expired token",
      };
    }

    // Check for Parents role
    if (!payload.roles || !payload.roles.includes("Therapist")) {
      return {
        statusCode: 401,
        message: "Unauthorized: Not a therapist user",
      };
    }

    // Return user info
    return {
      statusCode: 200,
      message: "Authorized",
      data: {
        username: payload.username,
        roles: payload.roles,
      },
    };
  } catch (error) {
    console.log("Backend error:", error);
    return {
      statusCode: 401,
      message: "Unauthorized",
    };
  }
});
