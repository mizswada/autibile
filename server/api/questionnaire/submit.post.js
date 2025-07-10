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

    return {
      statusCode: 200,
      message: "Questionnaire submitted successfully",
      data: {
        respond_id: qrRecord.qr_id,
        total_score: totalScore,
        threshold: threshold ? {
          interpretation: threshold.scoring_interpretation,
          recommendation: threshold.scoring_recommendation
        } : null
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