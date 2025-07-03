// Added by: Firzana Huda
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import sha256 from "crypto-js/sha256.js"

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userID, fullName, email, phone, ic, password, roleIDs } = body;

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
    
    // Only convert roleIDs if they are explicitly provided
    let roleIDsInt = [];
    const shouldUpdateRoles = roleIDs !== undefined;
    
    if (shouldUpdateRoles) {
      roleIDsInt = roleIDs.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      if (roleIDs.length > 0 && roleIDsInt.length !== roleIDs.length) {
        return {
          statusCode: 400,
          message: 'One or more invalid role IDs provided',
        };
      }
    }

    // First, check if the user exists and has admin role
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
        message: 'Cannot update: User is not an administrator',
      };
    }

    // Build user update data
    const userUpdateData = {};

    if (fullName) userUpdateData.userFullName = fullName;
    if (email) userUpdateData.userEmail = email;
    if (phone) userUpdateData.userPhone = phone;
    if (ic) userUpdateData.userIC = ic;
    
    // Update password if provided
    if (password) {
      userUpdateData.userPassword = sha256(password).toString();
    }

    // Use transaction to ensure all updates are done atomically
    const result = await prisma.$transaction(async (prisma) => {
      // Update user data
      const updatedUser = await prisma.user.update({
        where: { userID: userIDInt },
        data: {
          ...userUpdateData,
          userModifiedDate: new Date()
        }
      });

      // Only update roles if roleIDs were explicitly provided in the request
      if (shouldUpdateRoles && roleIDsInt.length > 0) {
        // Ensure at least one admin role is assigned
        let adminRoleFound = false;
        for (const roleID of roleIDsInt) {
          const role = await prisma.role.findUnique({
            where: { roleID: roleID }
          });
          
          if (role && role.roleName && role.roleName.includes('Admin')) {
            adminRoleFound = true;
            break;
          }
        }

        if (!adminRoleFound) {
          throw new Error('At least one admin role must be assigned');
        }

        // Delete existing user-role associations
        await prisma.userrole.deleteMany({
          where: { userRoleUserID: userIDInt }
        });

        // Create new user-role associations
        for (const roleID of roleIDsInt) {
          await prisma.userrole.create({
            data: {
              userRoleUserID: userIDInt,
              userRoleRoleID: roleID,
              userRoleCreatedDate: new Date()
            }
          });
        }
      }

      return updatedUser;
    });

    return {
      statusCode: 200,
      message: 'Administrator updated successfully',
      data: result
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: `Error updating administrator: ${error.message}`
    };
  }
}); 