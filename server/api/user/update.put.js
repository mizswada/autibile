import sha256 from "crypto-js/sha256.js";

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

    const body = await readBody(event);
    const { 
      fullName, 
      email, 
      phone, 
      currentPassword, 
      newPassword,
      // Doctor-specific fields
      registration_no,
      specialty,
      department,
      qualifications,
      experience_years,
    } = body;

    // Validate required fields
    if (!fullName || !email || !phone) {
      return {
        statusCode: 400,
        message: "Full name, email, and phone are required fields",
      };
    }
    
    // Validate doctor-specific fields if provided
    if (registration_no || specialty || department || qualifications || experience_years) {
      if (!registration_no || !specialty || !department || !qualifications || !experience_years) {
        return {
          statusCode: 400,
          message: "All doctor-specific fields are required when updating professional information",
        };
      }
      
      // Validate experience_years is a positive number
      const years = parseInt(experience_years);
      if (isNaN(years) || years < 0) {
        return {
          statusCode: 400,
          message: "Experience years must be a valid positive number",
        };
      }
    }

    // Check if user exists
    const userRecord = await prisma.user.findUnique({
      where: {
        userID: parseInt(user.userID),
      },
    });

    if (!userRecord) {
      return {
        statusCode: 404,
        message: "User not found",
      };
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return {
          statusCode: 400,
          message: "Current password is required to set a new password",
        };
      }

      const hashedCurrentPassword = sha256(currentPassword).toString();
      if (userRecord.userPassword !== hashedCurrentPassword) {
        return {
          statusCode: 401,
          message: "Current password is incorrect",
        };
      }
    }

    // Prepare update data
    const updateData = {
      userFullName: fullName,
      userEmail: email,
      userPhone: phone,
      userModifiedDate: new Date(),
    };
    
    // Update practitioner data if provided
    let updatedPractitioner = null;
    if (registration_no && specialty && department && qualifications && experience_years) {
      // Check if practitioner record exists
      const existingPractitioner = await prisma.user_practitioners.findFirst({
        where: {
          user_id: parseInt(user.userID),
          type: 'doctor',
          deleted_at: null,
        },
      });
      
      if (existingPractitioner) {
        // Update existing practitioner record
        updatedPractitioner = await prisma.user_practitioners.update({
          where: {
            practitioner_id: existingPractitioner.practitioner_id,
          },
          data: {
            registration_no,
            specialty,
            department,
            qualifications,
            experience_years: parseInt(experience_years),
            updated_at: new Date(),
          },
          select: {
            practitioner_id: true,
            type: true,
            registration_no: true,
            specialty: true,
            department: true,
            qualifications: true,
            experience_years: true,
            status: true,
          },
        });
      } else {
        // Create new practitioner record
        updatedPractitioner = await prisma.user_practitioners.create({
          data: {
            user_id: parseInt(user.userID),
            type: 'doctor',
            registration_no,
            specialty,
            department,
            qualifications,
            experience_years: parseInt(experience_years),
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
          select: {
            practitioner_id: true,
            type: true,
            registration_no: true,
            specialty: true,
            department: true,
            qualifications: true,
            experience_years: true,
            status: true,
          },
        });
      }
    }

    // Add new password if provided
    if (newPassword) {
      updateData.userPassword = sha256(newPassword).toString();
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: {
        userID: parseInt(user.userID),
      },
      data: updateData,
      select: {
        userID: true,
        userUsername: true,
        userFullName: true,
        userEmail: true,
        userPhone: true,
        userStatus: true,
      },
    });

    return {
      statusCode: 200,
      message: "Profile updated successfully",
      data: {
        ...updatedUser,
        practitioner: updatedPractitioner,
      },
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    
    // Handle duplicate email
    if (error.code === 'P2002' && error.meta?.target?.includes('userEmail')) {
      return {
        statusCode: 409,
        message: "Email address is already in use by another account",
      };
    }
    
    return {
      statusCode: 500,
      message: "Internal server error: " + error.message,
    };
  }
}); 