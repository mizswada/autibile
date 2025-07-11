import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('body', body);
    const { user } = event.context.user;
 
    const { faq_language,faq_question, faq_answer, faq_status} = body;
 
    if ( faq_language ||!faq_question || !faq_answer || !faq_status) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
 
 
 
    // Create faq record
    const faq = await prisma.faq.create({
      data: {
        faq_languange: faq_language,
        faq_question: faq_question,
        faq_answer: faq_answer,
        faq_status: faq_status,
        created_at: DateTime.now().toISO(),
        updated_at: DateTime.now().toISO(),
      },
    });
 
    if (!faq) {
      return {
        statusCode: 400,
        message: "Failed to create question",
      };
    }
 
    return {
      statusCode: 200,
      message: "question added successfully",
      data: faq,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});