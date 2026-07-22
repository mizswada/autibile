import { mapSortedAnswers } from "~/server/utils/questionnaireOrder";
import { buildCompositeBreakdown } from "~/server/utils/questionnaireCompositeScoring";
import { mapQuestionnaireAnswer } from "~/server/utils/formatQuestionnaireAnswer";

export default defineEventHandler(async (event) => {

    // Helper function to get score interpretation and recommendation
    const getScoreInterpretation = async (questionnaireId, totalScore) => {
      try {
        const threshold = await prisma.questionnaire_scoring.findFirst({
          where: {
            scoring_questionnaires: questionnaireId,
            scoring_min: {
              lte: totalScore
            },
            scoring_max: {
              gte: totalScore
            },
            deleted_at: null
          }
        });
        
        return threshold ? {
          interpretation: threshold.scoring_interpretation,
          interpretation_bm: threshold.scoring_interpretation_bm,
          recommendation: threshold.scoring_recommendation,
          recommendation_bm: threshold.scoring_recommendation_bm,
          threshold_id: threshold.scoring_ID,
          score_range: {
            min: threshold.scoring_min,
            max: threshold.scoring_max
          }
        } : null;
      } catch (error) {
        console.error("Error fetching score interpretation:", error);
        return null;
      }
    };
  
    try {
    
      const query = getQuery(event);
      console.log(query);
      const { questionnaireId, patientId, qrId, parentId } = query;
  
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

      // If parentId is provided, filter by children of that parent
      if (parentId) {
        // Get all patient IDs that belong to this parent
        const parentChildren = await prisma.user_parent_patient.findMany({
          where: {
            parent_id: parseInt(parentId)
          },
          select: {
            patient_id: true
          }
        });
        
        const childPatientIds = parentChildren.map(child => child.patient_id);
        
        // Add patient_id filter to only include responses from this parent's children
        if (childPatientIds.length > 0) {
          whereClause.patient_id = {
            in: childPatientIds
          };
        } else {
          // If parent has no children, return empty result
          return {
            statusCode: 200,
            message: "No children found for this parent",
            data: []
          };
        }
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
  
      // Format the responses for the frontend with score interpretation
      const formattedResponses = await Promise.all(responses.map(async (response) => {
        // Get score interpretation and recommendation
        const scoreAnalysis = await getScoreInterpretation(
          response.questionnaire_id, 
          response.total_score || 0
        );

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
          // Include score interpretation and recommendation
          score_analysis: scoreAnalysis,
          // Include AI analysis if available
          ai_analysis: response.ai_analysis_results
            ? { result: response.ai_analysis_results.ai_result, explanation: response.ai_analysis_results.ai_explanation }
            : null,
          answers: mapSortedAnswers(
            response.questionnaires_questions_answers,
            mapQuestionnaireAnswer,
          ),
        };
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