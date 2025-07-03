// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const practitionerID = body.practitionerID;

    if (!practitionerID) {
      return {
        statusCode: 400,
        message: 'Missing practitioner ID',
      };
    }

    // Find the practitioner first to get the associated user_id
    const practitioner = await prisma.user_practitioners.findUnique({
      where: { practitioner_id: parseInt(practitionerID) },
      select: { user_id: true }
    });

    if (!practitioner) {
      return {
        statusCode: 404,
        message: 'Practitioner not found',
      };
    }

    // Only update user information if all required fields are present
    if (body.fullName && body.email && body.phone && body.ic) {
      await prisma.user.update({
        where: { userID: practitioner.user_id },
        data: {
          userFullName: body.fullName,
          userEmail: body.email,
          userPhone: body.phone,
          userIC: body.ic,
        },
      });
    }

    // Process signature properly
    let signatureValue = null;
    if (body.signature) {
      // Check if it's an array or object
      if (typeof body.signature === 'object') {
        // If it's an array or object, we'll ignore it
      } else {
        // If it's a string, use it
        signatureValue = body.signature;
      }
    }

    const updated = await prisma.user_practitioners.update({
      where: { practitioner_id: parseInt(practitionerID) },
      data: {
        type: body.type,
        registration_no: body.registrationNo,
        specialty: body.specialty,
        department: body.department,
        qualifications: body.qualification,
        experience_years: parseInt(body.experience),
        ...(signatureValue !== null && { signature: signatureValue }),
        status: body.status || 'Active', // Default to Active if not provided
      },
    });

    return {
      statusCode: 200,
      message: 'Practitioner updated successfully',
      data: updated,
    };
  } catch (error) {
    console.error('Update failed:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
});
