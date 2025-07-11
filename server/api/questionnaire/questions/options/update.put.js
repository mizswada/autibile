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
      option_id,
      option_title,
      option_value,
      order_number
    } = body;

    // Basic validation
    if (!option_id || !option_title) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    // Check if option exists
    const existingOption = await prisma.questionnaires_questions_action.findUnique({
      where: {
        option_id: parseInt(option_id)
      }
    });

    if (!existingOption) {
      return {
        statusCode: 404,
        message: "Option not found",
      };
    }

    // Update the option
    const updated = await prisma.questionnaires_questions_action.update({
      where: {
        option_id: parseInt(option_id)
      },
      data: {
        option_title: option_title,
        option_value: option_value ? parseInt(option_value) : existingOption.option_value,
        order_number: order_number ? parseInt(order_number) : existingOption.order_number,
        updated_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: "Option updated successfully",
      data: updated,
    };

  } catch (error) {
    console.error("Error updating question option:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 