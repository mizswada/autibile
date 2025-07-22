import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const { id } = query;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing community ID",
      };
    }

    // Soft delete post record
    const deletedPost = await prisma.community.update({
      where: {
        community_id: parseInt(id)
      },
      data: {
        deleted_at: DateTime.now().toISO(),
      },
    });

    if (!deletedPost) {
      return {
        statusCode: 400,
        message: "Failed to delete post",
      };
    }

    return {
      statusCode: 200,
      message: "post deleted successfully",
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