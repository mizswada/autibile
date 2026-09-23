// Added by: Firzana Huda
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    // Find users with admin roles
    const users = await prisma.user.findMany({
      where: {
        userStatus: {
          not: 'INACTIVE' // Filter out inactive users
        },
        userrole: {
          some: {
            role: {
              roleName: {
                contains: 'Admin'
              }
            }
          }
        }
      },
      select: {
        userID: true,
        userFullName: true,
        userUsername: true,
        userEmail: true,
        userPhone: true,
        userIC: true,
        userStatus: true,
        userCreatedDate: true,
        userrole: {
          select: {
            role: {
              select: {
                roleName: true
              }
            }
          }
        }
      },
      orderBy: {
        userFullName: 'asc'
      }
    });

    // Map data to a cleaner format
    const mappedAdmins = users.map(user => {
      // Get role names from the userrole relationship
      const roles = user.userrole.map(ur => ur.role?.roleName).filter(Boolean).join(', ');
      
      return {
        userID: user.userID,
        fullName: user.userFullName,
        username: user.userUsername || '',
        email: user.userEmail,
        phone: user.userPhone,
        ic: user.userIC,
        registeredAt: user.userCreatedDate || null,
        status: user.userStatus,
        role: roles
      };
    });

    return {
      statusCode: 200,
      message: 'Administrators retrieved successfully',
      data: mappedAdmins
    };
  } catch (error) {
    console.error('Error retrieving administrators:', error);
    return {
      statusCode: 500,
      message: 'Error retrieving administrators',
      error: error.message
    };
  }
}); 