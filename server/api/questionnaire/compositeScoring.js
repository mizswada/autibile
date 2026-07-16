import { validateCompositeScoringConfig } from "~/server/utils/questionnaireCompositeScoring";

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === "GET") {
    return handleGet(event);
  } else if (method === "POST") {
    return handlePost(event);
  }

  return {
    statusCode: 405,
    message: "Method Not Allowed",
  };
});

// GET handler - fetch the composite scoring config for a questionnaire
async function handleGet(event) {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const query = getQuery(event);
    const { questionnaireId } = query;

    if (!questionnaireId) {
      return {
        statusCode: 400,
        message: "Missing required parameter: questionnaireId",
      };
    }

    const questionnaire = await prisma.questionnaires.findUnique({
      where: { questionnaire_id: parseInt(questionnaireId) },
      select: { composite_scoring_config: true },
    });

    if (!questionnaire) {
      return {
        statusCode: 404,
        message: "Questionnaire not found",
      };
    }

    let config = null;
    if (questionnaire.composite_scoring_config) {
      try {
        config = JSON.parse(questionnaire.composite_scoring_config);
      } catch (error) {
        config = null;
      }
    }

    return {
      statusCode: 200,
      message: "Success",
      data: config,
    };
  } catch (error) {
    console.error("Error fetching composite scoring config:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
    };
  }
}

// POST handler - create/update/clear the composite scoring config
async function handlePost(event) {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);
    const { questionnaire_id, composite_scoring_config } = body;

    if (!questionnaire_id) {
      return {
        statusCode: 400,
        message: "Missing required field: questionnaire_id",
      };
    }

    const validation = validateCompositeScoringConfig(composite_scoring_config);
    if (!validation.ok) {
      return {
        statusCode: 400,
        message: validation.message,
      };
    }

    await prisma.questionnaires.update({
      where: { questionnaire_id: parseInt(questionnaire_id) },
      data: {
        composite_scoring_config: validation.config
          ? JSON.stringify(validation.config)
          : null,
        updated_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Composite scoring configuration saved successfully",
      data: validation.config,
    };
  } catch (error) {
    console.error("Error saving composite scoring config:", error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
    };
  }
}
