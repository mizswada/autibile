// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    // Extract userID from the session context
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);

    const {
      question_id,
      option_title,
      option_value,
      order_number
    } = body;

    // Basic validation
    if (!question_id || !option_title) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    console.log('Body:', body);

    // Check if question exists
    const existingQuestion = await prisma.questionnaires_questions.findUnique({
      where: {
        question_id: parseInt(question_id)
      }
    });

    if (!existingQuestion) {
      return {
        statusCode: 404,
        message: "Question not found",
      };
    }

    // Save to DB - using questionnaires_questions relation instead of direct question_id
    const saved = await prisma.questionnaires_questions_action.create({
      data: {
        questionnaires_questions: {
          connect: { question_id: parseInt(question_id) }
        },
        option_title: option_title,
        option_value: option_value ? parseInt(option_value) : 0,
        order_number: order_number ? parseInt(order_number) : null,
        created_at: new Date()
      },
    });

    return {
      statusCode: 200,
      message: "Option added successfully",
      data: saved,
    };

  } catch (error) {
    console.error("Error inserting question option:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 