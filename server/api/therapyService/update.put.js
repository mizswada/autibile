import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    console.log('event - edit');
    const query = getQuery(event);
    const body = await readBody(event);

    const { id } = query;
    const { name, description} = body;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing service ID",
      };
    }

    if (!name || !description) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    // alert(JSON.stringify(id));
    // Update centre record
    const updatedService = await prisma.service.update({
      where: {
        service_id: parseInt(id)
      },
      data: {
        name: name,
        description: description,
        updated_at: DateTime.now().toISO(),
      },
    });

    if (!updatedService) {
      return {
        statusCode: 400,
        message: "Failed to update centre",
      };
    }

    return {
      statusCode: 200,
      message: "Service updated successfully",
      data: updatedService,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 