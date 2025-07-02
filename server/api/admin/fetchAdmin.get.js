// Added by: Firzana Huda
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const userID = query.userID;

    if (!userID) {
      return {
        statusCode: 400,
        message: 'Missing administrator ID',
      };
    }

    // Convert userID to integer for Prisma
    const userIDInt = parseInt(userID);
    
    if (isNaN(userIDInt)) {
      return {
        statusCode: 400,
        message: 'Invalid administrator ID format',
      };
    }

    const user = await prisma.user.findUnique({
      where: { userID: userIDInt },
      select: {
        userID: true,
        userUsername: true,
        userFullName: true,
        userEmail: true,
        userPhone: true,
        userIC: true,
        userStatus: true,
        userrole: {
          select: {
            userRoleRoleID: true,
            role: {
              select: {
                roleID: true,
                roleName: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return {
        statusCode: 404,
        message: 'Administrator not found',
      };
    }

    // Check if user has admin role
    const isAdmin = user.userrole.some(ur => ur.role && ur.role.roleName && ur.role.roleName.includes('Admin'));
    
    if (!isAdmin) {
      return {
        statusCode: 403,
        message: 'User is not an administrator',
      };
    }

    // Format the user data
    const adminData = {
      userID: user.userID,
      username: user.userUsername,
      fullName: user.userFullName,
      email: user.userEmail,
      phone: user.userPhone,
      ic: user.userIC,
      status: user.userStatus,
      roleIDs: user.userrole.map(ur => ur.userRoleRoleID),
      roles: user.userrole.map(ur => ({
        id: ur.role?.roleID,
        name: ur.role?.roleName
      }))
    };

    return {
      statusCode: 200,
      message: 'Administrator retrieved successfully',
      data: adminData
    };
  } catch (error) {
    console.error('Error fetching administrator:', error);
    return {
      statusCode: 500,
      message: 'Error retrieving administrator',
      error: error.message
    };
  }
}); 