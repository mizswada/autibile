import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { user } = event.context.user;
 
    const { center_name, center_phone, center_address, center_location } = body;

    // Get centreID from query
    const centreID = getQuery(event).id;

    if (!centreID || !center_name || !center_phone || !center_address || !center_location) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    const autismCenter = await prisma.therapyst_center.update({
      where: {
        center_id: parseInt(centreID),
      },
      data: {
        center_name: center_name,
        center_phone: center_phone,
        center_address: center_address,
        center_location: center_location,
        // Optionally update created_at if needed
        // created_at: DateTime.now().toISO(),
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

