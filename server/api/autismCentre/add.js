import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log("body", body);
    const { user } = event.context.user;
 
    const { center_name, center_phone, center_address, center_location } = body;
 
    if (!center_name || !center_phone || !center_address || !center_location) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    const autismCenter = await prisma.therapyst_center.create({
      data: {
        center_name: center_name,
        center_phone: center_phone,
        center_address: center_address,
        center_location: center_location,
        created_at: DateTime.now().toISO(),
      },
    });

    if (!autismCenter) {
      return {
        statusCode: 400,
        message: "Failed to create center",
      };
    }
 
    return {
      statusCode: 200,
      message: "Center added successfully",
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
 

