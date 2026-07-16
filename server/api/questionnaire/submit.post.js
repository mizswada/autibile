// Added by: Firzana Huda 24 June 2025
import {
  assertCanSubmit,
  lockAfterSubmit,
} from "~/server/utils/questionnaireAccess";

export default defineEventHandler(async (event) => {
  try {
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

    if (patientId) {
      const accessCheck = await assertCanSubmit(
        parseInt(patientId),
        parseInt(questionnaireId),
      );
      if (!accessCheck.allowed) {
        return {
          statusCode: 400,
          message: accessCheck.message,
        };
      }
    }

    const qrRecord = await prisma.questionnaires_responds.create({
      data: {
        questionnaire_id: parseInt(questionnaireId),
        patient_id: patientId ? parseInt(patientId) : null,
        created_at: new Date(),
      },
    });

    let totalScore = 0;

    const savedAnswers = await Promise.all(
      answers.map(async (answer) => {
        let score = null;

        if (answer.option_id) {
          const option = await prisma.questionnaires_questions_action.findUnique(
            {
              where: {
                option_id: parseInt(answer.option_id),
              },
            },
          );

          if (option && option.option_value) {
            score = option.option_value;
            totalScore += score;
          }
        } else if (answer.numeric_answer) {
          score = parseInt(answer.numeric_answer);
          totalScore += score;
        }

        return prisma.questionnaires_questions_answers.create({
          data: {
            qr_id: qrRecord.qr_id,
            question_id: parseInt(answer.question_id),
            option_id: answer.option_id ? parseInt(answer.option_id) : null,
            score: score,
            text_answer: answer.text_answer || null,
            created_at: new Date(),
          },
        });
      }),
    );

    await prisma.questionnaires_responds.update({
      where: {
        qr_id: qrRecord.qr_id,
      },
      data: {
        total_score: totalScore,
      },
    });

    if (patientId) {
      await lockAfterSubmit(parseInt(patientId), parseInt(questionnaireId));
    }

    const threshold = await prisma.questionnaire_scoring.findFirst({
      where: {
        scoring_questionnaires: parseInt(questionnaireId),
        scoring_min: {
          lte: totalScore,
        },
        scoring_max: {
          gte: totalScore,
        },
        deleted_at: null,
      },
    });

    let redirectToQuestionnaire2 = false;
    let scoreInterpretation = null;
    if (parseInt(questionnaireId) === 1 && patientId) {
      if (totalScore >= 3 && totalScore <= 7) {
        redirectToQuestionnaire2 = true;
        scoreInterpretation =
          "Medium Risk - Follow-up questionnaire recommended";
      } else if (totalScore >= 0 && totalScore <= 2) {
        scoreInterpretation = "Low Risk - No follow-up required";
      } else if (totalScore >= 8) {
        scoreInterpretation =
          "High Risk - Immediate professional evaluation recommended";
      }
    }

    return {
      statusCode: 200,
      message: "Questionnaire submitted successfully",
      data: {
        respond_id: qrRecord.qr_id,
        total_score: totalScore,
        threshold: threshold
          ? {
              interpretation: threshold.scoring_interpretation,
              interpretation_bm: threshold.scoring_interpretation_bm,
              recommendation: threshold.scoring_recommendation,
              recommendation_bm: threshold.scoring_recommendation_bm,
            }
          : null,
        redirect_to_questionnaire_2: redirectToQuestionnaire2,
        score_interpretation: scoreInterpretation,
        questionnaire_id: parseInt(questionnaireId),
      },
    };
  } catch (error) {
    console.error("Error submitting questionnaire:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    };
  }
});
