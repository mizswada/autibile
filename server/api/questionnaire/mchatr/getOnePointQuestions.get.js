// API endpoint to get MCHATR-F questions based on MCHATR 1-point questions
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { patientId } = query;

    if (!patientId) {
      return {
        statusCode: 400,
        message: "Missing required parameter: patientId"
      };
    }

    // Get the latest MCHATR response for this patient
    const mchatrResponse = await prisma.questionnaires_responds.findFirst({
      where: {
        questionnaire_id: 1, // MCHATR questionnaire ID
        patient_id: parseInt(patientId)
      },
      include: {
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

    if (!mchatrResponse) {
      return {
        statusCode: 404,
        message: "No MCHATR response found for this patient"
      };
    }

    // Check if patient is eligible for MCHATR-F (score 3-7)
    if (mchatrResponse.total_score < 3 || mchatrResponse.total_score > 7) {
      return {
        statusCode: 400,
        message: "Patient is not eligible for MCHATR-F follow-up questionnaire",
        data: {
          mchatr_total_score: mchatrResponse.total_score,
          eligibility: mchatrResponse.total_score < 3 ? 'Low Risk' : 'High Risk',
          recommendation: mchatrResponse.total_score < 3 ? 'No follow-up required' : 'Immediate professional evaluation recommended'
        }
      };
    }

    // Find questions that scored 1 point (elevated likelihood)
    const onePointQuestions = mchatrResponse.questionnaires_questions_answers
      .filter(answer => answer.score === 1)
      .map(answer => ({
        question_id: answer.question_id,
        question_text: answer.questionnaires_questions?.question_text_bi,
        question_text_bm: answer.questionnaires_questions?.question_text_bm,
        selected_answer: answer.questionnaires_questions_action?.option_title,
        option_value: answer.questionnaires_questions_action?.option_value,
        score: answer.score
      }));

    if (onePointQuestions.length === 0) {
      return {
        statusCode: 200,
        message: "No follow-up questions needed",
        data: {
          questions: [],
          one_point_mchatr_questions: [],
          mchatr_total_score: mchatrResponse.total_score,
          message: "All MCHATR questions scored 0 (typical development). No follow-up needed."
        }
      };
    }

    // Perfect approach: Use mchatr_id to map MCHATR-F questions to 1-point MCHATR questions
    // MCHATR-F questions with mchatr_id = MCHATR question ID are the follow-up questions
    const onePointQuestionIds = onePointQuestions.map(q => q.question_id);
    

    // Get MCHATR-F questions that have mchatr_id matching the 1-point MCHATR questions
    const mchatrFQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        questionnaire_id: 2, // MCHATR-F questionnaire ID
        mchatr_id: {
          in: onePointQuestionIds // mchatr_id must match one of the 1-point MCHATR question IDs
        },
        status: 'Active',
        deleted_at: null
      },
      orderBy: [
        { order: 'asc' }, // Primary ordering by order field
        { mchatr_id: 'asc' }, // Group by parent MCHATR question
        { question_id: 'asc' } // Then by question ID within each group
      ]
    });


    // Get options for each MCHATR-F question
    const questionsWithOptions = await Promise.all(
      mchatrFQuestions.map(async (question) => {
        const options = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: question.question_id,
            deleted_at: null
          },
          orderBy: {
            option_id: 'asc'
          }
        });

        return {
          ...question,
          options: options.map(option => ({
            ...option,
            option_type: extractOptionType(option.option_title),
            original_title: option.option_title,
            option_title: cleanOptionTitle(option.option_title),
            conditional_sub_questions_ids: option.conditional_sub_questions_ids
          }))
        };
      })
    );

    return {
      statusCode: 200,
      message: "MCHATR-F questions retrieved successfully",
      data: {
        questions: questionsWithOptions,
        one_point_mchatr_questions: onePointQuestions,
        mchatr_total_score: mchatrResponse.total_score,
        risk_level: mchatrResponse.total_score >= 3 && mchatrResponse.total_score <= 7 ? 'Medium Risk' : 'Unknown',
        recommendation: 'Follow-up questionnaire recommended',
        questions_shown: mchatrFQuestions.length,
        debug_info: {
          one_point_mchatr_questions: onePointQuestionIds,
          found_mchatr_f_questions: mchatrFQuestions.map(q => q.question_id),
          mchatr_id_mapping: mchatrFQuestions.map(q => ({ mchatr_f_id: q.question_id, mchatr_id: q.mchatr_id })),
          questions_shown: mchatrFQuestions.length,
          approach: "mchatr_id_mapping"
        },
        scoring_breakdown: mchatrResponse.questionnaires_questions_answers.map(answer => ({
          question_id: answer.question_id,
          score: answer.score,
          option_value: answer.questionnaires_questions_action?.option_value,
          option_title: answer.questionnaires_questions_action?.option_title
        }))
      }
    };

  } catch (error) {
    console.error("Error retrieving MCHATR-F questions:", error);
    return {
      statusCode: 500,
      message: "Internal server error"
    };
  }
});

// Helper functions
function extractOptionType(optionTitle) {
  if (!optionTitle) return 'radio';
  
  if (optionTitle.startsWith('[radio]')) return 'radio';
  if (optionTitle.startsWith('[checkbox]')) return 'checkbox';
  if (optionTitle.startsWith('[scale]')) return 'scale';
  if (optionTitle.startsWith('[text]')) return 'text';
  if (optionTitle.startsWith('[textarea]')) return 'textarea';
  
  return 'radio';
}

function cleanOptionTitle(optionTitle) {
  if (!optionTitle) return '';
  
  return optionTitle
    .replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '')
    .trim();
}