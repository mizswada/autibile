import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const { id } = query;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing faq ID",
      };
    }

    // Soft delete question record
    const deletedFaq = await prisma.faq.update({
      where: {
        faq_ID: parseInt(id)
      },
      data: {
        deleted_at: DateTime.now().toISO(),
      },
    });

    if (!deletedFaq) {
      return {
        statusCode: 400,
        message: "Failed to delete question",
      };
    }

    return {
      statusCode: 200,
      message: "Question deleted successfully",
      data: deletedFaq,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 