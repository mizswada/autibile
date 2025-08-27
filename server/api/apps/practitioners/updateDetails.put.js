export default defineEventHandler(async (event) => {
    try {
      const body = await readBody(event);
      const {
        practitionerID,
        fullName,
        email,
        phone,
        ic,
        type,
        registrationNo,
        specialty,
        department,
        qualification,
        experience,
        signature,
        workplace, // Add workplace field
      } = body;
  
      // Validate required fields
      if (!practitionerID) {
        return {
          statusCode: 400,
          message: 'Practitioner ID is required',
        };
      }
  
      // Check if practitioner exists
      const existingPractitioner = await prisma.user_practitioners.findFirst({
        where: {
          practitioner_id: parseInt(practitionerID),
          deleted_at: null,
        },
        include: {
          user: true,
        },
      });
  
      if (!existingPractitioner) {
        return {
          statusCode: 404,
          message: 'Practitioner not found',
        };
      }
  
      // Update user information
      if (existingPractitioner.user) {
        await prisma.user.update({
          where: {
            userID: existingPractitioner.user.userID,
          },
          data: {
            userFullName: fullName || existingPractitioner.user.userFullName,
            userEmail: email || existingPractitioner.user.userEmail,
            userPhone: phone || existingPractitioner.user.userPhone,
            userIC: ic || existingPractitioner.user.userIC,
          },
        });
      }
  
      // Update practitioner information
      const updatedPractitioner = await prisma.user_practitioners.update({
        where: {
          practitioner_id: parseInt(practitionerID),
        },
        data: {
          type: type || existingPractitioner.type,
          registration_no: registrationNo || existingPractitioner.registration_no,
          specialty: specialty || existingPractitioner.specialty,
          department: department || existingPractitioner.department,
          qualifications: qualification || existingPractitioner.qualifications,
          experience_years: experience ? parseInt(experience) : existingPractitioner.experience_years,
          signature: signature || existingPractitioner.signature,
          workplace: workplace || existingPractitioner.workplace, // Add workplace field
          updated_at: new Date(),
        },
      });
  
      // Return updated practitioner data
      const updatedPractitionerWithUser = await prisma.user_practitioners.findFirst({
        where: {
          practitioner_id: parseInt(practitionerID),
          deleted_at: null,
        },
        include: {
          user: {
            select: {
              userUsername: true,
              userFullName: true,
              userEmail: true,
              userPhone: true,
              userIC: true,
            },
          },
        },
      });
  
      const formattedResponse = {
        practitionerID: updatedPractitionerWithUser.practitioner_id,
        userID: updatedPractitionerWithUser.user_id,
        username: updatedPractitionerWithUser.user?.userUsername || '',
        fullName: updatedPractitionerWithUser.user?.userFullName || '',
        email: updatedPractitionerWithUser.user?.userEmail || '',
        type: updatedPractitionerWithUser.type || '',
        registrationNo: updatedPractitionerWithUser.registration_no || '',
        phone: updatedPractitionerWithUser.user?.userPhone || '',
        ic: updatedPractitionerWithUser.user?.userIC || '',
        specialty: updatedPractitionerWithUser.specialty || '',
        department: updatedPractitionerWithUser.department || '',
        qualification: updatedPractitionerWithUser.qualifications || '',
        experience: updatedPractitionerWithUser.experience_years || '',
        signature: updatedPractitionerWithUser.signature || '',
        workplace: updatedPractitionerWithUser.workplace || '', // Add workplace field
        status: updatedPractitionerWithUser.status || '',
      };
  
      return {
        statusCode: 200,
        message: 'Practitioner information updated successfully',
        data: formattedResponse,
      };
  
    } catch (error) {
      console.error('PUT /api/apps/practitioners/updateDetails error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message,
      };
    }
  });