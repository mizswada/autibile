// Added by: Firzana Huda
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import sha256 from "crypto-js/sha256.js"

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const { 
      username, 
      fullName, 
      email, 
      phone, 
      ic, 
      password,
      roleIDs = [] // Array of role IDs
    } = body;

    // Validation
    if (!username || !fullName || !email || !password || !ic) {
      return {
        statusCode: 400,
        message: 'Missing required fields',
      };
    }

    // Check if username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        userUsername: username
      }
    });

    if (existingUser) {
      return {
        statusCode: 400,
        message: 'Username already exists',
      };
    }

    // Hash the password with SHA256
    const hashedPassword = sha256(password).toString();

    // Create the user in a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (prisma) => {
      // Create the user
      const newUser = await prisma.user.create({
        data: {
          userUsername: username,
          userFullName: fullName,
          userEmail: email,
          userPhone: phone,
          userIC: ic,
          userPassword: hashedPassword,
          userStatus: 'Active',
          userCreatedDate: new Date(),
        }
      });

      // Ensure we have at least one admin role
      let adminRoleFound = false;
      for (const roleID of roleIDs) {
        const role = await prisma.role.findUnique({
          where: { roleID: roleID }
        });
        
        if (role && role.roleName && role.roleName.includes('Admin')) {
          adminRoleFound = true;
        }
      }

      if (!adminRoleFound) {
        // If no admin role was provided, find the default admin role
        const adminRole = await prisma.role.findFirst({
          where: {
            roleName: {
              contains: 'Admin'
            }
          }
        });

        if (adminRole) {
          roleIDs.push(adminRole.roleID);
        } else {
          throw new Error('No admin role found in the database');
        }
      }

      // Create user-role associations
      for (const roleID of roleIDs) {
        await prisma.userrole.create({
          data: {
            userRoleUserID: newUser.userID,
            userRoleRoleID: roleID,
            userRoleCreatedDate: new Date()
          }
        });
      }

      return newUser;
    });

    return {
      statusCode: 200,
      message: 'Administrator created successfully',
      data: {
        userID: result.userID,
        username: result.userUsername,
        fullName: result.userFullName,
        email: result.userEmail,
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      message: `Error creating administrator: ${error.message}`,
      error: error.message
    };
  }
}); 