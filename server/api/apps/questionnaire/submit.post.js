import {
  assertCanSubmit,
  lockAfterSubmit,
} from "~/server/utils/questionnaireAccess";
import {
  isNumberAnswerType,
  validateNumericAnswerValue,
} from "~/server/utils/questionnaireNumberConfig";
import {
  parseCompositeScoringConfig,
  computeCompositeScores,
} from "~/server/utils/questionnaireCompositeScoring";

export default defineEventHandler(async (event) => {
    try {
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
  
      // Create a new questionnaire response record
      const qrRecord = await prisma.questionnaires_responds.create({
        data: {
          questionnaire_id: parseInt(questionnaireId),
          patient_id: patientId ? parseInt(patientId) : null,
          created_at: new Date()
        }
      });
  
      // Load the questionnaire so we can apply an optional composite scoring recipe.
      const questionnaireRecord = await prisma.questionnaires.findUnique({
        where: { questionnaire_id: parseInt(questionnaireId) },
        select: { composite_scoring_config: true },
      });
      const compositeConfig = parseCompositeScoringConfig(
        questionnaireRecord?.composite_scoring_config,
      );

      // Calculate total score
      let totalScore = 0;
      const perAnswerScores = [];
      const numericAnswersByQuestionId = {};

      // Save each answer
      // Validate numeric answers before saving
      for (const answer of answers) {
        if (
          answer.numeric_answer === undefined ||
          answer.numeric_answer === null ||
          answer.numeric_answer === ""
        ) {
          continue;
        }

        const question = await prisma.questionnaires_questions.findUnique({
          where: { question_id: parseInt(answer.question_id) },
        });

        if (!question) {
          return {
            statusCode: 400,
            message: `Question ${answer.question_id} not found`,
          };
        }

        if (await isNumberAnswerType(question.answer_type)) {
          const numericValidation = validateNumericAnswerValue(
            answer.numeric_answer,
            question.scoring_config,
          );
          if (!numericValidation.ok) {
            return {
              statusCode: 400,
              message: numericValidation.message,
            };
          }
        }
      }

      // Save each answer
      const savedAnswers = await Promise.all(
        answers.map(async (answer) => {
          let score = null;
          let numericAnswer = null;

          const question = await prisma.questionnaires_questions.findUnique({
            where: {
              question_id: parseInt(answer.question_id),
            },
          });

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
            }
          } else if (answer.numeric_answer !== undefined && answer.numeric_answer !== null && answer.numeric_answer !== "") {
            const numericValidation = validateNumericAnswerValue(
              answer.numeric_answer,
              question?.scoring_config,
            );

            numericAnswer = numericValidation.ok
              ? numericValidation.value
              : parseInt(answer.numeric_answer);
            score = numericAnswer;
            numericAnswersByQuestionId[parseInt(answer.question_id)] = numericAnswer;
          }

          if (score !== null) {
            perAnswerScores.push({
              question_id: parseInt(answer.question_id),
              score,
            });
          }
  
          // Create the answer record
          return prisma.questionnaires_questions_answers.create({
            data: {
              qr_id: qrRecord.qr_id,
              question_id: parseInt(answer.question_id),
              option_id: answer.option_id ? parseInt(answer.option_id) : null,
              score: score,
              numeric_answer: numericAnswer,
              text_answer: answer.text_answer || null,
              created_at: new Date()
            }
          });
        })
      );
  
      // Compute the total score, applying the composite scoring recipe if present.
      let compositeGroups = [];
      if (compositeConfig) {
        const composite = computeCompositeScores(
          compositeConfig,
          numericAnswersByQuestionId,
        );
        compositeGroups = composite.groups;

        // Sum the raw scores of every answer that is NOT part of a composite
        // group, then add the discrete group scores on top.
        const rawNonMemberTotal = perAnswerScores.reduce((sum, entry) => {
          return composite.memberQuestionIds.has(entry.question_id)
            ? sum
            : sum + entry.score;
        }, 0);

        totalScore = rawNonMemberTotal + composite.groupScoresTotal;
      } else {
        totalScore = perAnswerScores.reduce((sum, entry) => sum + entry.score, 0);
      }

      // Update the questionnaire response with the total score
      await prisma.questionnaires_responds.update({
        where: {
          qr_id: qrRecord.qr_id
        },
        data: {
          total_score: totalScore
        }
      });

      // Lock questionnaire access after successful submission
      if (patientId) {
        await lockAfterSubmit(parseInt(patientId), parseInt(questionnaireId));
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

      // AI analysis call
      let aiAnalysis = null;
      let aiErrorMessage = null;
      try {
        console.log('[SUBMIT] Building answer summary...');
        const answerSummary = await Promise.all(
          savedAnswers.map(async (a) => {
            const question = await prisma.questionnaires_questions.findUnique({
              where: { question_id: a.question_id },
              select: { question_text_bi: true }
            });
            let answerText = a.text_answer ?? '';
            if (a.option_id) {
              const option = await prisma.questionnaires_questions_action.findUnique({
                where: { option_id: a.option_id },
                select: { option_title: true }
              });
              answerText = option?.option_title?.replace(/^\[(radio|checkbox|scale|text|textarea)\]/, '').trim() ?? answerText;
            } else if (a.numeric_answer !== null && a.numeric_answer !== undefined) {
              answerText = String(a.numeric_answer);
            }
            return { question: question?.question_text_bi ?? String(a.question_id), answer: answerText };
          })
        );
        console.log(`[SUBMIT] Answer summary ready with ${answerSummary.length} answers`);

        console.log('[SUBMIT] Calling AI analysis...');
        const aiResult = await getAIAnalysisResult({
          questionnaireName: `Questionnaire ${questionnaireId}`,
          totalScore,
          scoreMin: threshold?.scoring_min ?? 0,
          scoreMax: threshold?.scoring_max ?? 999,
          thresholdInterpretation: threshold?.scoring_interpretation ?? null,
          answers: answerSummary,
          isMchatr: parseInt(questionnaireId) === 1
        });

        if (aiResult.ok) {
          console.log('[SUBMIT] AI response received, saving to DB...');
          const aiResponse = aiResult.data;
          await prisma.ai_analysis_results.upsert({
            where: { qr_id: qrRecord.qr_id },
            create: {
              qr_id: qrRecord.qr_id,
              questionnaire_id: parseInt(questionnaireId),
              patient_id: patientId ? parseInt(patientId) : null,
              ai_result: aiResponse.result,
              ai_explanation: aiResponse.explanation,
              provider_used: 'ai',
              created_at: new Date()
            },
            update: {
              ai_result: aiResponse.result,
              ai_explanation: aiResponse.explanation,
              provider_used: 'ai'
            }
          });
          aiAnalysis = aiResponse;
          console.log('[SUBMIT] AI analysis saved successfully');
        } else {
          aiErrorMessage = aiResult.message;
          console.log('[SUBMIT] AI analysis failed:', aiErrorMessage);
        }
      } catch (aiError) {
        aiErrorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        console.error('[SUBMIT] AI analysis exception:', aiErrorMessage, aiError);
      }

      return {
        statusCode: 200,
        message: "Questionnaire submitted successfully",
        data: {
          respond_id: qrRecord.qr_id,
          total_score: totalScore,
          threshold: threshold ? {
            interpretation: threshold.scoring_interpretation,
            interpretation_bm: threshold.scoring_interpretation_bm,
            recommendation: threshold.scoring_recommendation,
            recommendation_bm: threshold.scoring_recommendation_bm,
            admin_recommendation: threshold.admin_recommendation,
          } : null,
          redirect_to_questionnaire_2: redirectToQuestionnaire2,
          score_interpretation: scoreInterpretation,
          questionnaire_id: parseInt(questionnaireId),
          composite_scores: compositeGroups,
          ai_analysis: aiAnalysis,
          ai_error: aiErrorMessage,
          debug: {
            ai_was_attempted: true,
            threshold_found: !!threshold,
            ai_enabled: process.env.AI_ENABLED
          }
        }
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