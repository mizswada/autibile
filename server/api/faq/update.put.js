import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    console.log('event - edit');
    const query = getQuery(event);
    const body = await readBody(event);

    const { id } = query;
    const { faq_languange, faq_question, faq_answer, faq_status } = body;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing faq ID",
      };
    }

    if (!faq_languange || !faq_question || !faq_answer || !faq_status) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    // Update faq record
    const updatedFaq = await prisma.faq.update({
      where: {
        faq_ID: parseInt(id)
      },
      data: {
        faq_languange: faq_languange,
        faq_question: faq_question,
        faq_answer: faq_answer,
        faq_status: faq_status,
        updated_at: DateTime.now().toISO(),
      },
    });

    if (!updatedFaq) {
      return {
        statusCode: 400,
        message: "Failed to update question",
      };
    }

    return {
      statusCode: 200,
      message: "Question updated successfully",
      data: updatedFaq,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 