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
    const { questionnaireId, answers, patientId } = body;

    if (!questionnaireId || !answers || !answers.length) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    // Special validation for questionnaire ID 1 (MCHAT-R)
    if (parseInt(questionnaireId) === 1 && patientId) {
      // Check patient's current mchatr_status first
      const patient = await prisma.user_patients.findUnique({
        where: {
          patient_id: parseInt(patientId)
        }
      });

      if (patient && patient.mchatr_status === 'Disable') {
        return {
          statusCode: 400,
          message: "This patient is not eligible to take the MCHAT-R questionnaire.",
        };
      }
      // If status is Enable or null, allow submission (no need to check existing response)
    }

    // Special validation for questionnaire ID 2 (only for patients who scored 3-7 on MCHAT-R)
    if (parseInt(questionnaireId) === 2 && patientId) {
      // Check if patient has completed MCHAT-R with score 3-7
      const mchatrResponse = await prisma.questionnaires_responds.findFirst({
        where: {
          questionnaire_id: 1,
          patient_id: parseInt(patientId)
        }
      });

      if (!mchatrResponse) {
        return {
          statusCode: 400,
          message: "This patient must complete the MCHAT-R questionnaire first.",
        };
      }

      // Check if MCHAT-R score is between 3-7
      if (mchatrResponse.total_score < 3 || mchatrResponse.total_score > 7) {
        return {
          statusCode: 400,
          message: "This questionnaire is only available for patients who scored 3-7 on the MCHAT-R questionnaire.",
        };
      }
    }

    // Create a new questionnaire response record
    const qrRecord = await prisma.questionnaires_responds.create({
      data: {
        questionnaire_id: parseInt(questionnaireId),
        patient_id: patientId ? parseInt(patientId) : null,
        created_at: new Date()
      }
    });

    // Calculate total score
    let totalScore = 0;

    // Save each answer
    const savedAnswers = await Promise.all(
      answers.map(async (answer) => {
        let score = null;
        
        // Calculate score based on answer type
        if (answer.option_id) {
          // For option-based answers, get score from the option
          const option = await prisma.questionnaires_questions_action.findUnique({
            where: {
              option_id: parseInt(answer.option_id)
            }
          });
          
          if (option && option.option_value) {
            score = option.option_value;
            totalScore += score;
          }
        } else if (answer.numeric_answer) {
          // For range type questions, use the numeric value directly as score
          score = parseInt(answer.numeric_answer);
          totalScore += score;
        }
        
        // Get the question to determine its type
        const question = await prisma.questionnaires_questions.findUnique({
          where: {
            question_id: parseInt(answer.question_id)
          }
        });

        // Create the answer record
        return prisma.questionnaires_questions_answers.create({
          data: {
            qr_id: qrRecord.qr_id,
            question_id: parseInt(answer.question_id),
            option_id: answer.option_id ? parseInt(answer.option_id) : null,
            score: score,
            text_answer: answer.text_answer || null,
            created_at: new Date()
          }
        });
      })
    );

    // Update the questionnaire response with the total score
    await prisma.questionnaires_responds.update({
      where: {
        qr_id: qrRecord.qr_id
      },
      data: {
        total_score: totalScore
      }
    });

    // If this is questionnaire ID 1 (MCHAT-R), update patient's mchatr_status to 'Disable'
    if (parseInt(questionnaireId) === 1 && patientId) {
      await prisma.user_patients.update({
        where: {
          patient_id: parseInt(patientId)
        },
        data: {
          mchatr_status: 'Disable',
          update_at: new Date()
        }
      });
    }

    // Fetch the appropriate threshold based on the total score
    const threshold = await prisma.questionnaire_scoring.findFirst({
      where: {
        scoring_questionnaires: parseInt(questionnaireId),
        scoring_min: {
          lte: totalScore
        },
        scoring_max: {
          gte: totalScore
        },
        deleted_at: null
      }
    });

    // Special handling for MCHAT-R (questionnaire ID 1)
    let redirectToQuestionnaire2 = false;
    let scoreInterpretation = null;
    if (parseInt(questionnaireId) === 1 && patientId) {
      // Check if score is between 3-7 for MCHAT-R
      if (totalScore >= 3 && totalScore <= 7) {
        redirectToQuestionnaire2 = true;
        scoreInterpretation = "Medium Risk - Follow-up questionnaire recommended";
      } else if (totalScore >= 0 && totalScore <= 2) {
        scoreInterpretation = "Low Risk - No follow-up required";
      } else if (totalScore >= 8) {
        scoreInterpretation = "High Risk - Immediate professional evaluation recommended";
      }
    }

    return {
      statusCode: 200,
      message: "Questionnaire submitted successfully",
      data: {
        respond_id: qrRecord.qr_id,
        total_score: totalScore,
        threshold: threshold ? {
          interpretation: threshold.scoring_interpretation,
          recommendation: threshold.scoring_recommendation
        } : null,
        redirect_to_questionnaire_2: redirectToQuestionnaire2,
        score_interpretation: scoreInterpretation,
        questionnaire_id: parseInt(questionnaireId)
      }
    };

  } catch (error) {
    console.error("Error submitting questionnaire:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 