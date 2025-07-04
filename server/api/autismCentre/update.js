import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { user } = event.context.user;
 
    const { center_name, center_phone, center_address, center_location } = body;
 
   if (!center_name || !center_phone || !center_address || !center_location) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    const autismCenter = await prisma.therapyst_center.update({
      where: {
        centre_id: parseInt(centreID),
      },
      data: {
        center_id: user.centerID,
        center_name: center_name,
        center_phone: phone,
        center_address: address,
        center_location: location,
        created_at: DateTime.now().toISO(),
      },
    });
 
    if (!autismCenter) {
      return {
        statusCode: 400,
        message: "Failed to update centre",
      };
    }
 
    return {
      statusCode: 200,
      message: "centre updated successfully",
      data: autismCenter,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});

