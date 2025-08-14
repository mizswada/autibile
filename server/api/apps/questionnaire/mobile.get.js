export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { questionnaireID, patientID } = query;

    if (!questionnaireID) {
      return {
        statusCode: 400,
        message: "Missing questionnaire ID parameter",
      };
    }

    // Get questionnaire details
    const questionnaire = await prisma.questionnaires.findUnique({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null
      },
      select: {
        questionnaire_id: true,
        title: true,
        description: true,
        header: true,
        status: true
      }
    });

    if (!questionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    // Get patient information if patientID is provided
    let patientInfo = null;
    let mchatrEligibility = null;
    
    if (patientID) {
      patientInfo = await prisma.user_patients.findUnique({
        where: {
          patient_id: parseInt(patientID)
        },
        select: {
          patient_id: true,
          fullname: true,
          mchatr_status: true,
          created_at: true
        }
      });

      if (patientInfo) {
        // Check MCHAT-R eligibility for this patient
        if (parseInt(questionnaireID) === 1) {
          // For MCHAT-R questionnaire, check if patient has already completed it
          const existingResponse = await prisma.questionnaires_responds.findFirst({
            where: {
              questionnaire_id: 1,
              patient_id: parseInt(patientID)
            }
          });

          const hasCompletedMchatr = !!existingResponse;
          const isEligible = patientInfo.mchatr_status === 'Enable' || patientInfo.mchatr_status === null;
          const canRetake = (patientInfo.mchatr_status === 'Enable' || patientInfo.mchatr_status === null) && hasCompletedMchatr;
          
          // Get MCHAT-R score if completed
          let mchatrScore = null;
          if (existingResponse) {
            mchatrScore = existingResponse.total_score;
          }

          mchatrEligibility = {
            patient_id: patientInfo.patient_id,
            patient_name: patientInfo.fullname,
            mchatr_status: patientInfo.mchatr_status,
            has_completed_mchatr: hasCompletedMchatr,
            is_eligible: isEligible,
            can_take_mchatr: isEligible,
            can_retake_mchatr: canRetake,
            mchatr_score: mchatrScore,
            is_eligible_for_questionnaire_2: mchatrScore !== null && mchatrScore >= 3 && mchatrScore <= 7
          };
        } else if (parseInt(questionnaireID) === 2) {
          // For questionnaire ID 2, check if patient is eligible based on MCHAT-R score
          const mchatrResponse = await prisma.questionnaires_responds.findFirst({
            where: {
              questionnaire_id: 1,
              patient_id: parseInt(patientID)
            }
          });

          const mchatrScore = mchatrResponse ? mchatrResponse.total_score : null;
          const isEligibleForQuestionnaire2 = mchatrScore !== null && mchatrScore >= 3 && mchatrScore <= 7;

          mchatrEligibility = {
            patient_id: patientInfo.patient_id,
            patient_name: patientInfo.fullname,
            mchatr_status: patientInfo.mchatr_status,
            has_completed_mchatr: !!mchatrResponse,
            mchatr_score: mchatrScore,
            is_eligible_for_questionnaire_2: isEligibleForQuestionnaire2,
            can_take_questionnaire_2: isEligibleForQuestionnaire2
          };
        }
      }
    }

    // Get all questions for this questionnaire
    const allQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null
      },
      orderBy: [
        { parentID: 'asc' }, // null parentID first (top-level questions)
        { question_id: 'asc' }
      ]
    });

    // Separate top-level questions and sub-questions
    const topLevelQuestions = allQuestions.filter(q => !q.parentID);
    const subQuestions = allQuestions.filter(q => q.parentID);

    // Build the mobile-optimized questionnaire structure
    const mobileQuestionnaire = {
      ...questionnaire,
      patient_info: patientInfo,
      mchatr_eligibility: mchatrEligibility,
      questions: []
    };

    // Process top-level questions with all their conditional logic
    for (const topQuestion of topLevelQuestions) {
      const questionNode = {
        ...topQuestion,
        options: [],
        conditional_logic: [],
        sub_questions: []
      };

      // Get options for this question
      const options = await prisma.questionnaires_questions_action.findMany({
        where: {
          question_id: topQuestion.question_id,
          deleted_at: null
        },
        orderBy: { option_id: 'asc' }
      });

      questionNode.options = options;

      // Process conditional logic for each option
      for (const option of options) {
        if (option.conditional_sub_questions_ids) {
          try {
            const conditionalIds = JSON.parse(option.conditional_sub_questions_ids);
            if (conditionalIds.length > 0) {
              // Get the actual conditional sub-questions
              const conditionalSubQuestions = await prisma.questionnaires_questions.findMany({
                where: {
                  question_id: { in: conditionalIds },
                  questionnaire_id: parseInt(questionnaireID),
                  deleted_at: null
                },
                orderBy: { question_id: 'asc' }
              });

              // Get options for each conditional sub-question
              const conditionalSubQuestionsWithOptions = await Promise.all(
                conditionalSubQuestions.map(async (q) => {
                  const qOptions = await prisma.questionnaires_questions_action.findMany({
                    where: {
                      question_id: q.question_id,
                      deleted_at: null
                    },
                    orderBy: { option_id: 'asc' }
                  });
                  return { ...q, options: qOptions };
                })
              );

              questionNode.conditional_logic.push({
                option_id: option.option_id,
                option_value: option.option_value,
                option_title: option.option_title,
                conditional_sub_questions: conditionalSubQuestionsWithOptions
              });
            }
          } catch (error) {
            console.error('Error parsing conditional sub-questions IDs:', error);
          }
        }
      }

      // Get all sub-questions for this top-level question (non-conditional)
      const questionSubQuestions = subQuestions.filter(q => q.parentID === topQuestion.question_id);
      
      // Process sub-questions
      for (const subQuestion of questionSubQuestions) {
        const subQuestionNode = {
          ...subQuestion,
          options: []
        };

        // Get options for sub-question
        const subOptions = await prisma.questionnaires_questions_action.findMany({
          where: {
            question_id: subQuestion.question_id,
            deleted_at: null
          },
          orderBy: { option_id: 'asc' }
        });
        subQuestionNode.options = subOptions;

        questionNode.sub_questions.push(subQuestionNode);
      }

      mobileQuestionnaire.questions.push(questionNode);
    }

    return {
      statusCode: 200,
      message: "Mobile questionnaire retrieved successfully",
      data: mobileQuestionnaire,
    };

  } catch (error) {
    console.error("Error retrieving mobile questionnaire:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
