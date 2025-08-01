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

    // Find active Doctor practitioner user
    const user = await prisma.user.findFirst({
      where: {
        userEmail: username,
        userStatus: "Active",
        userrole: {
          some: {
            role: {
              roleName: "Practitioners",
            },
          },
        },
        user_practitioners: {
          some: { 
            type: "Therapist",
            status: "Active"
          },
        },
      },
      include: {
        user_practitioners: {
          select: {
            practitioner_id: true,
          },
        },
      },
    });

   // console.log('user', user);

    if (!user) {
      return {
        statusCode: 404,
        message: "Therapist does not exist",
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

    // Assign role as Doctor directly
    const roleNames = ['Therapist'];

    const practitionerId = user.user_practitioners.length > 0 ? user.user_practitioners[0].practitioner_id : null;
    
    const userPractitioners = await prisma.user_practitioners.findFirst({
      where: {
        practitioner_id: practitionerId,
        AND: [
          {
            registration_no: { not: null },
          },
          {
            registration_no: { not: '' },
          },
        ],
      },
    });
    

    // Generate tokens with Therapist role
    const accessToken = generateAccessToken({
      username: user.userUsername,
      roles: roleNames,
    });

    const refreshToken = generateRefreshToken({
      username: user.userUsername,
      roles: roleNames,
    });

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
        hasPractitionerInfo: !!userPractitioners,
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

function generateRefreshToken(user) {
  return jwt.sign(user, ENV.auth.secretRefresh, { expiresIn: "30d" });
}
