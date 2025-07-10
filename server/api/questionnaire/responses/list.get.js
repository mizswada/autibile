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

    const query = getQuery(event);
    const { questionnaireId, patientId, qrId } = query;

    // Build where clause based on query parameters
    const whereClause = {};
    
    if (questionnaireId) {
      whereClause.questionnaire_id = parseInt(questionnaireId);
    }
    
    if (patientId) {
      whereClause.patient_id = parseInt(patientId);
    }

    if (qrId) {
      whereClause.qr_id = parseInt(qrId);
    }

    // Fetch responses with related data
    const responses = await prisma.questionnaires_responds.findMany({
      where: whereClause,
      include: {
        questionnaires: true,
        user_patients: true,
        questionnaires_questions_answers: {
          include: {
            questionnaires_questions: true,
            questionnaires_questions_action: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Format the responses for the frontend
    const formattedResponses = responses.map(response => ({
      qr_id: response.qr_id,
      questionnaire_id: response.questionnaire_id,
      questionnaire_title: response.questionnaires?.title || 'Unknown',
      patient_id: response.patient_id,
      patient_name: response.patient_id ? (response.user_patients?.fullname || 'Patient Not Found') : 'No Patient Selected',
      total_score: response.total_score || 0,
      created_at: response.created_at,
      answers: response.questionnaires_questions_answers.map(answer => ({
        answer_id: answer.answer_id,
        question_id: answer.question_id,
        question_text: answer.questionnaires_questions?.question_text_bi || 'Unknown',
        option_id: answer.option_id,
        option_title: answer.questionnaires_questions_action?.option_title || 'Unknown',
        option_value: answer.questionnaires_questions_action?.option_value || 0,
        score: answer.score || 0,
        parentID: answer.questionnaires_questions?.parentID || null // Include parentID for sub-questions
      }))
    }));

    return {
      statusCode: 200,
      message: "Responses retrieved successfully",
      data: formattedResponses
    };

  } catch (error) {
    console.error("Error retrieving questionnaire responses:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 