import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const { id } = query;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing centre ID",
      };
    }

    // Soft delete centre record
    const deletedCentre = await prisma.therapyst_center.update({
      where: {
        center_ID: parseInt(id)
      },
      data: {
        deleted_at: DateTime.now().toISO(),
      },
    });

    if (!deletedCentre) {
      return {
        statusCode: 400,
        message: "Failed to delete centre",
      };
    }

    return {
      statusCode: 200,
      message: "Centre deleted successfully",
      data: deletedCentre,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 