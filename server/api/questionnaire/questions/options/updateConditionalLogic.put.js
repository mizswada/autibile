// Added by: Assistant - Update Conditional Logic Mapping API
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
    const { option_id, option_value, subQuestionsToShow } = body;

    if (!option_id) {
      return createError({
        statusCode: 400,
        statusMessage: 'Option ID is required'
      });
    }

    // Update the option value and store the conditional sub-questions mapping
    const updatedOption = await prisma.questionnaires_questions_action.update({
      where: { option_id: parseInt(option_id) },
      data: { 
        option_value: parseInt(option_value),
        conditional_sub_questions_ids: JSON.stringify(subQuestionsToShow || []),
        updated_at: new Date()
      }
    });

    return { 
      statusCode: 200, 
      message: "Conditional logic updated successfully", 
      data: {
        option: updatedOption,
        subQuestionsToShow: subQuestionsToShow || []
      }
    };
  } catch (error) {
    console.error('Error updating conditional logic:', error);
    return createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    });
  }
}); 