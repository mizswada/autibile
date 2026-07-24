import sha256 from "crypto-js/sha256.js";
import { requireAdmin } from "~/server/utils/reports/guard";

export default defineEventHandler(async (event) => {
  const guard = requireAdmin(event);
  if (!guard.ok) {
    return {
      statusCode: guard.statusCode,
      message: guard.message,
    };
  }

  try {
    const body = await readBody(event);
    const userID = parseInt(body.userID, 10);
    const { password, confirmPassword } = body;

    if (!userID || !password || !confirmPassword) {
      return {
        statusCode: 400,
        message: "User ID, password, and confirm password are required",
      };
    }

    if (password.length < 8) {
      return {
        statusCode: 400,
        message: "Password must be at least 8 characters long",
      };
    }

    if (password !== confirmPassword) {
      return {
        statusCode: 400,
        message: "Passwords do not match",
      };
    }

    const user = await prisma.user.findFirst({
      where: { userID },
      select: {
        userID: true,
        userUsername: true,
        userFullName: true,
      },
    });

    if (!user) {
      return {
        statusCode: 404,
        message: "User not found",
      };
    }

    await prisma.user.update({
      where: { userID },
      data: {
        userPassword: sha256(password).toString(),
        userModifiedDate: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Password updated successfully",
      data: {
        userID: user.userID,
        username: user.userUsername,
        fullName: user.userFullName,
      },
    };
  } catch (error) {
    console.error("Admin reset password error:", error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});
