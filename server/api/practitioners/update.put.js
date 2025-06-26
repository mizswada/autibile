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

    const updated = await prisma.user_practitioners.update({
      where: { practitioner_id: practitionerID },
      data: {
        type: body.type,
        registration_no: body.registrationNo,
        specialty: body.specialty,
        department: body.department,
        qualifications: body.qualification,
        experience_years: parseInt(body.experience),
        signature: body.signature,
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
