import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const { id } = query;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing service ID",
      };
    }

    // Soft delete service record
    const deletedService = await prisma.service.update({
      where: {
        service_id: parseInt(id)
      },
      data: {
        deleted_at: DateTime.now().toISO(),
      },
    });

    if (!deletedService) {
      return {
        statusCode: 400,
        message: "Failed to delete centre",
      };
    }

    return {
      statusCode: 200,
      message: "Service deleted successfully",
      data: deletedService,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 