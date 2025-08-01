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
        userStatus: "Active",
        userrole: {
          some: {
            role: {
              roleName: "Parents",
            },
          },
        },
      },
      include: {
        user_parents: {
          select: {
            parent_id: true,
          },
        },
      },
    });
    
    //console.log('user',user);

    if (!user) {
      return {
        statusCode: 404,
        message: "Parents does not exist",
        data: null,
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

    const parentId = user.user_parents.length > 0 ? user.user_parents[0].parent_id : null;
    
    const userParents = await prisma.user_parents.findFirst({
      where: {
        parent_id: parentId,
        parent_relationship: {
          not: null,
        },
      },
    });
    
    // Get all patient IDs from the parent's children through user_parent_patient junction table
    const patientData = await prisma.user_parent_patient.findMany({
      where: {
        parent_id: parentId,
      },
      include: {
        user_patients: {
          select: {
            patient_id: true,
            fullname: true,
          },
        },
      },
    });

    const patientIds = patientData.map(data => ({
      patient_id: data.user_patients.patient_id,
      fullname: data.user_patients.fullname,
    }));

    // Return tokens in response body
    return {
      statusCode: 200,
      message: "Login success",
      data: {
        username: user.userFullName,
        roles: roleNames,
        userID: user.userID,
        parentId: parentId,
        patientIds: patientIds,
        accessToken: accessToken,
        refreshToken: refreshToken,
        hasParentInfo: !!userParents,
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
