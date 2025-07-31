export default defineEventHandler(async (event) => {
    try {
      const body = await readBody(event);
  
      const {
        parentID,
        fullName,
        email,
        phone,
        addressLine1,
        addressLine2,
        addressLine3,
        city,
        postcode,
        gender,
        dateOfBirth,
        relationship,
        nationality,
        state,
        status,
      } = body;
  
      // Check required values
      if (!parentID) {
        return {
          statusCode: 400,
          message: 'Missing parentID',
        };
      }
  
      // Get parent record to extract userID
      const parentRecord = await prisma.user_parents.findUnique({
        where: {
          parent_id: parseInt(parentID),
        },
      });
  
      if (!parentRecord) {
        return {
          statusCode: 404,
          message: 'Parent not found',
        };
      }
  
      const userID = parentRecord.user_id;
  
      // Update the parent-specific fields in user_parents table
      await prisma.user_parents.update({
        where: {
          parent_id: parseInt(parentID),
        },
        data: {
          parent_add1: addressLine1 || '',
          parent_add2: addressLine2 || '',
          parent_add3: addressLine3 || '',
          parent_city: city || '',
          parent_postcode: postcode || '',
          parent_gender: gender || '',
          parent_dob: dateOfBirth ? new Date(dateOfBirth) : null,
          parent_relationship: relationship ? parseInt(relationship) : null,
          parent_nationality: nationality ? parseInt(nationality) : null,
          parent_state: state ? parseInt(state) : null,
          parent_status: status || 'Active',
          updated_at: new Date(),
        },
      });
  
      // Update the user account fields in user table (fixed table name)
      await prisma.user.update({
        where: {
          userID: userID,
        },
        data: {
          userFullName: fullName || '',
          userEmail: email || '',
          userPhone: phone || '',
          userModifiedDate: new Date(),
        },
      });
  
      return {
        statusCode: 200,
        message: 'Parent updated successfully',
      };
    } catch (error) {
      console.error('Error updating parent:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message,
      };
    }
  });
  