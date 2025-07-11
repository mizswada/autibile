export default defineEventHandler(async (event) => {
  try {
   
    const faq = await prisma.faq.findMany({
      select: {
        faq_ID: true,
        faq_languange: true,
        faq_question: true,
        faq_answer: true,
        faq_status: true,
        lookup: {
          select: {
            title: true,
            value: true
          }
        }
      },
      where: {
        deleted_at: null
      },
      orderBy: {
        faq_ID: 'asc'
      }
    });
 
    if (!faq || faq.length === 0) {
      return [];
    }
 
    // Transform the data to match the expected format
    const transformedFaq = faq.map((faq, index) => ({
      no: index + 1,
      id: faq.faq_ID, // Add this line for frontend compatibility
      faq_language: faq.lookup ? faq.lookup.title : '',
      faq_question: faq.faq_question,
      faq_answer: faq.faq_answer,
      faq_status: faq.faq_status,
    }));
 
    return transformedFaq;
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});