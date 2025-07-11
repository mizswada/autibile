export default defineEventHandler(async (event) => {
  try {
    // Get user from the context
    const user = event.context.user;
    
    if (!user || !user.userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    // Get user data
    const userData = await prisma.user.findUnique({
      where: {
        userID: parseInt(user.userID),
      },
      select: {
        userID: true,
        userUsername: true,
        userFullName: true,
        userEmail: true,
        userPhone: true,
        userIC: true,
        userStatus: true,
      },
    });

    if (!userData) {
      return {
        statusCode: 404,
        message: "User not found",
      };
    }

    // Get user roles
    const roles = await prisma.userrole.findMany({
      where: {
        userRoleUserID: userData.userID,
      },
      select: {
        role: {
          select: {
            roleID: true,
            roleName: true,
          },
        },
      },
    });

    const roleNames = roles.map((r) => ({
      id: r.role.roleID,
      name: r.role.roleName,
    }));

    return {
      statusCode: 200,
      message: "User profile fetched successfully",
      data: {
        ...userData,
        roles: roleNames,
      },
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return {
      statusCode: 500,
      message: "Internal server error: " + error.message,
    };
  }
});
  