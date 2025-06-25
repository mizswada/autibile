// Added by: Firzana Huda 24 June 2025
import sha256 from "crypto-js/sha256.js";
import jwt from "jsonwebtoken";

const ENV = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const parentID = body.parentID;

    if (!parentID) {
      return {
        statusCode: 400,
        message: 'Missing parent ID',
      };
    }

    const updated = await prisma.user_parents.update({
      where: { parent_id: parentID },
      data: {
        parent_relationship: parseInt(body.relationship),
        parent_gender: body.gender,
        parent_dob: new Date(body.dateOfBirth),
        parent_nationality: parseInt(body.nationality),
        parent_phone: body.phone,
        parent_add1: body.childrenNames?.[0] || null,
        parent_add2: body.childrenNames?.[1] || null,
        parent_add3: body.childrenNames?.[2] || null,
        parent_city: body.city,
        parent_postcode: body.postcode,
        parent_state: parseInt(body.state),
        parent_status: body.status,
      },
    });

    return {
      statusCode: 200,
      message: 'Parent updated successfully',
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
