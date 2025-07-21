import sha256 from "crypto-js/sha256.js";
import jwt from "jsonwebtoken";

const ENV = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  try {
    const { username, password } = await readBody(event);

    if (!username || !password) {
      return {
        statusCode: 400,
        message: "Username and password are required",
      };
    }

    const user = await prisma.user.findFirst({
      where: {
        userEmail: username,
      },
    });

    // console.log('user',user);

    if (!user) {
      return {
        statusCode: 404,
        message: "User does not exist",
      };
    }

    const hashedPassword = sha256(password).toString();
    if (user.userPassword !== hashedPassword) {
      return {
        statusCode: 401,
        message: "Invalid password",
      };
    }

    // Get user roles
    const roles = await prisma.userrole.findMany({
      where: {
        userRoleUserID: user.userID,
      },
      select: {
        role: {
          select: {
            roleName: true,
          },
        },
      },
    });

    const roleNames = roles.map((r) => r.role.roleName);

    // Restrict login: Only Admins and Practitioners of type Doctor (status Active)
    const isAdmin = roleNames.some((role) => role.includes("Admin"));
    const isPractitioner = roleNames.some((role) => role === "Practitioners");
    let isDoctor = false;

    if (isPractitioner) {
      // Check if this practitioner is a Doctor and Active
      const doctor = await prisma.user_practitioners.findFirst({
        where: {
          user_id: user.userID,
          type: "Doctor",
          status: "Active",
        },
      });
      if (doctor) {
        isDoctor = true;
      }
    }

    if (!isAdmin && !isDoctor) {
      return {
        statusCode: 403,
        message: "You are not authorized to log in. Only administrators and active doctors are allowed.",
      };
    }

    const accessToken = generateAccessToken({
      username: user.userUsername,
      roles: roleNames,
    });

    const refreshToken = generateRefreshToken({
      username: user.userUsername,
      roles: roleNames,
    });

    // Set cookie httpOnly
    event.res.setHeader("Set-Cookie", [
      `accessToken=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
    ]);

    return {
      statusCode: 200,
      message: "Login success",
      data: {
        username: user.userUsername,
        roles: roleNames,
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

function generateRefreshToken(user) {
  return jwt.sign(user, ENV.auth.secretRefresh, { expiresIn: "30d" });
}
