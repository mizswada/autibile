import {
  getMchatrEligibility,
  getQuestionnaireAccessInfo,
  MCHATR_QUESTIONNAIRE_ID,
  MCHATR_F_QUESTIONNAIRE_ID,
} from "~/server/utils/questionnaireAccess";

import { optionOrderBy, questionOrderBy } from "~/server/utils/questionnaireOrder";
import {
  enrichQuestionWithNumberConfig,
  getNumberAnswerTypeLookupId,
} from "~/server/utils/questionnaireNumberConfig";

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

    const questionnaire = await prisma.questionnaires.findFirst({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null,
        hidden: { not: true },
      },
      select: {
        questionnaire_id: true,
        title: true,
        description: true,
        header: true,
        status: true,
        min_age_months: true,
        max_age_months: true,
        age_warning_enabled: true,
      },
    });

    if (!questionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    let patientInfo = null;
    let mchatrEligibility = null;
    let questionnaireAccess = null;

    if (patientID) {
      patientInfo = await prisma.user_patients.findUnique({
        where: {
          patient_id: parseInt(patientID),
        },
        select: {
          patient_id: true,
          fullname: true,
          created_at: true,
          dob: true,
        },
      });

      if (patientInfo) {
        const questionnaireId = parseInt(questionnaireID);
        questionnaireAccess = await getQuestionnaireAccessInfo(
          parseInt(patientID),
          questionnaireId,
        );
        mchatrEligibility = await getMchatrEligibility(parseInt(patientID));

        if (questionnaireId === MCHATR_F_QUESTIONNAIRE_ID) {
          mchatrEligibility = {
            ...mchatrEligibility,
            can_take_questionnaire_2: questionnaireAccess.can_access,
          };
        }
      }
    }

    const allQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        questionnaire_id: parseInt(questionnaireID),
        deleted_at: null,
      },
      orderBy: questionOrderBy,
    });

    const topLevelQuestions = allQuestions.filter((q) => !q.parentID);
    const subQuestions = allQuestions.filter((q) => q.parentID);

    const mobileQuestionnaire = {
      ...questionnaire,
      patient_info: patientInfo,
      mchatr_eligibility: mchatrEligibility,
      questionnaire_access: questionnaireAccess,
      number_answer_type_id: await getNumberAnswerTypeLookupId(),
      questions: [],
    };

    for (const topQuestion of topLevelQuestions) {
      const questionNode = await enrichQuestionWithNumberConfig({
        ...topQuestion,
        options: [],
        conditional_logic: [],
        sub_questions: [],
      });

      const options = await prisma.questionnaires_questions_action.findMany({
        where: {
          question_id: topQuestion.question_id,
          deleted_at: null,
        },
        orderBy: optionOrderBy,
      });

      questionNode.options = options;

      for (const option of options) {
        if (option.conditional_sub_questions_ids) {
          try {
            const conditionalIds = JSON.parse(
              option.conditional_sub_questions_ids,
            );
            if (conditionalIds.length > 0) {
              const conditionalSubQuestions =
                await prisma.questionnaires_questions.findMany({
                  where: {
                    question_id: { in: conditionalIds },
                    questionnaire_id: parseInt(questionnaireID),
                    deleted_at: null,
                  },
                  orderBy: questionOrderBy,
                });

              const conditionalSubQuestionsWithOptions = await Promise.all(
                conditionalSubQuestions.map(async (q) => {
                  const qOptions =
                    await prisma.questionnaires_questions_action.findMany({
                      where: {
                        question_id: q.question_id,
                        deleted_at: null,
                      },
                      orderBy: optionOrderBy,
                    });
                  return enrichQuestionWithNumberConfig({ ...q, options: qOptions });
                }),
              );

              questionNode.conditional_logic.push({
                option_id: option.option_id,
                option_value: option.option_value,
                option_title: option.option_title,
                conditional_sub_questions: conditionalSubQuestionsWithOptions,
              });
            }
          } catch (error) {
            console.error("Error parsing conditional sub-questions IDs:", error);
          }
        }
      }

      const questionSubQuestions = subQuestions.filter(
        (q) => q.parentID === topQuestion.question_id,
      );

      for (const subQuestion of questionSubQuestions) {
        const subQuestionNode = await enrichQuestionWithNumberConfig({
          ...subQuestion,
          options: [],
        });

        const subOptions = await prisma.questionnaires_questions_action.findMany(
          {
            where: {
              question_id: subQuestion.question_id,
              deleted_at: null,
            },
            orderBy: optionOrderBy,
          },
        );
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
      error: error.message,
    };
  }
});
