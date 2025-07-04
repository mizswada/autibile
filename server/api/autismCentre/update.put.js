import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    console.log('event - edit');
    const query = getQuery(event);
    const body = await readBody(event);

    const { id } = query;
    const { center_name, center_phone, center_address, center_location } = body;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing centre ID",
      };
    }

    if (!center_name || !center_phone || !center_address || !center_location) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    // alert(JSON.stringify(id));
    // Update centre record
    const updatedCentre = await prisma.therapyst_center.update({
      where: {
        center_ID: parseInt(id)
      },
      data: {
        center_name: center_name,
        center_phone: center_phone,
        center_address: center_address,
        center_location: center_location,
        updated_at: DateTime.now().toISO(),
      },
    });

    if (!updatedCentre) {
      return {
        statusCode: 400,
        message: "Failed to update centre",
      };
    }

    return {
      statusCode: 200,
      message: "Centre updated successfully",
      data: updatedCentre,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 