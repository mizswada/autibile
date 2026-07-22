import { mapSortedAnswers } from "~/server/utils/questionnaireOrder";
import { buildCompositeBreakdown } from "~/server/utils/questionnaireCompositeScoring";
import { mapQuestionnaireAnswer } from "~/server/utils/formatQuestionnaireAnswer";

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
        },
        ai_analysis_results: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Format the responses for the frontend
    const formattedResponses = responses.map(response => {
      const compositeBreakdown = buildCompositeBreakdown(
        response.questionnaires?.composite_scoring_config,
        response.questionnaires_questions_answers,
      );

      return {
      qr_id: response.qr_id,
      questionnaire_id: response.questionnaire_id,
      questionnaire_title: response.questionnaires?.title || 'Unknown',
      patient_id: response.patient_id,
      patient_name: response.patient_id ? (response.user_patients?.fullname || 'Patient Not Found') : 'No Patient Selected',
      total_score: response.total_score || 0,
      created_at: response.created_at,
      composite_scores: compositeBreakdown.composite_scores,
      composite_member_question_ids:
        compositeBreakdown.composite_member_question_ids,
      ai_analysis: response.ai_analysis_results
        ? { result: response.ai_analysis_results.ai_result, explanation: response.ai_analysis_results.ai_explanation }
        : null,
      answers: mapSortedAnswers(
        response.questionnaires_questions_answers,
        mapQuestionnaireAnswer,
      ),
    };
    });

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