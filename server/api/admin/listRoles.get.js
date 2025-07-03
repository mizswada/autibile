// Added by: Firzana Huda
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    const roles = await prisma.role.findMany({
      where: {
        roleStatus: 'Active'
      },
      select: {
        roleID: true,
        roleName: true,
        roleDescription: true
      },
      orderBy: {
        roleName: 'asc'
      }
    });

    return {
      statusCode: 200,
      message: 'Roles retrieved successfully',
      data: roles
    };
  } catch (error) {
    console.error('Error retrieving roles:', error);
    return {
      statusCode: 500,
      message: 'Error retrieving roles',
      error: error.message
    };
  }
}); 