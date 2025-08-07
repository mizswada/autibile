// Added by: Assistant - Update Option API for Conditional Logic
export default defineEventHandler(async (event) => {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    const body = await readBody(event);
    const { optionID, option_id, option_value, option_title, order_number } = body;
    
    // Support both optionID and option_id for compatibility
    const optionId = optionID || option_id;

    if (!optionId) {
      return createError({
        statusCode: 400,
        statusMessage: 'Option ID is required'
      });
    }

    // Prepare update data
    const updateData = {
      updated_at: new Date()
    };

    // Add option_value if provided
    if (option_value !== undefined) {
      updateData.option_value = parseInt(option_value);
    }

    // Add option_title if provided
    if (option_title !== undefined) {
      updateData.option_title = option_title;
    }

    // Add order_number if provided
    if (order_number !== undefined) {
      updateData.order_number = parseInt(order_number);
    }

    // Update the option
    const updatedOption = await prisma.questionnaires_questions_action.update({
      where: { option_id: parseInt(optionId) },
      data: updateData
    });


    return { 
      statusCode: 200, 
      message: "Option updated successfully", 
      data: updatedOption 
    };
  } catch (error) {
    console.error('Error updating option:', error);
    return createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    });
  }
}); 