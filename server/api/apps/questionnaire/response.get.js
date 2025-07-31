export default defineEventHandler(async (event) => {
    // Helper function to clean option titles
    const cleanOptionTitle = (optionTitle) => {
      if (!optionTitle) return '';
      return optionTitle.replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '').trim();
    };

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
          recommendation: threshold.scoring_recommendation,
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
          }
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

        return {
          qr_id: response.qr_id,
          questionnaire_id: response.questionnaire_id,
          questionnaire_title: response.questionnaires?.title || 'Unknown',
          patient_id: response.patient_id,
          patient_name: response.patient_id ? (response.user_patients?.fullname || 'Patient Not Found') : 'No Patient Selected',
          total_score: response.total_score || 0,
          created_at: response.created_at,
          // Include score interpretation and recommendation
          score_analysis: scoreAnalysis,
          answers: response.questionnaires_questions_answers.map(answer => ({
            answer_id: answer.answer_id,
            question_id: answer.question_id,
            question_text: answer.questionnaires_questions?.question_text_bi || 'Unknown',
            question_text_bm: answer.questionnaires_questions?.question_text_bm || '',
            option_id: answer.option_id,
            option_title: answer.questionnaires_questions_action ? cleanOptionTitle(answer.questionnaires_questions_action.option_title) || '' : '',
            option_value: answer.questionnaires_questions_action?.option_value || 0,
            text_answer: answer.text_answer || '',
            score: answer.score || 0,
            parentID: answer.questionnaires_questions?.parentID || null // Include parentID for sub-questions
          }))
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