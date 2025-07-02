// Added by: Firzana Huda
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userID, status } = body;

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

    if (!status || !['Active', 'Inactive'].includes(status)) {
      return {
        statusCode: 400,
        message: 'Invalid status value. Must be either "Active" or "Inactive"',
      };
    }

    // Verify the user is an admin before updating
    const user = await prisma.user.findUnique({
      where: { userID: userIDInt },
      include: {
        userrole: {
          include: {
            role: true
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

    // Check if the user has an admin role
    const isAdmin = user.userrole.some(ur => ur.role && ur.role.roleName && ur.role.roleName.includes('Admin'));
    
    if (!isAdmin) {
      return {
        statusCode: 403,
        message: 'Cannot update status: User is not an administrator',
      };
    }

    const updated = await prisma.user.update({
      where: { userID: userIDInt },
      data: {
        userStatus: status,
      },
    });

    return {
      statusCode: 200,
      message: `Administrator status updated to ${status}`,
      data: updated,
    };
  } catch (error) {
    console.error('Administrator status update failed:', error);
    return {
      statusCode: 500,
      message: `Internal server error: ${error.message}`,
    };
  }
}); 