// Added by: Firzana Huda
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    return handleGet(event);
  } else if (method === 'POST') {
    return handlePost(event);
  } else if (method === 'DELETE') {
    return handleDelete(event);
  }

  return {
    statusCode: 405,
    message: 'Method Not Allowed',
  };
});

// GET handler - fetch thresholds for a questionnaire
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
    const { questionnaireId, threshold_id } = query;

    if (!questionnaireId && !threshold_id) {
      return {
        statusCode: 400,
        message: "Missing required parameter: questionnaireId or threshold_id",
      };
    }

    const whereClause = {
      deleted_at: null,
    };

    if (questionnaireId) {
      whereClause.scoring_questionnaires = parseInt(questionnaireId);
    }

    if (threshold_id) {
      whereClause.scoring_ID = parseInt(threshold_id);
    }

    const thresholds = await prisma.questionnaire_scoring.findMany({
      where: whereClause,
      orderBy: {
        scoring_min: 'asc',
      },
    });

    // Transform the data to match the frontend expected format
    const transformedData = thresholds.map(threshold => ({
      threshold_id: threshold.scoring_ID,
      questionnaire_id: threshold.scoring_questionnaires,
      interpretation: threshold.scoring_interpretation,
      recommendation: threshold.scoring_recommendation,
      scoring_min: threshold.scoring_min,
      scoring_max: threshold.scoring_max
    }));

    return {
      statusCode: 200,
      message: "Success",
      data: transformedData,
    };
  } catch (error) {
    console.error('Error fetching thresholds:', error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
    };
  }
}

// POST handler - create or update a threshold
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
    const { 
      questionnaire_id, 
      scoring_min, 
      scoring_max, 
      interpretation, 
      recommendation,
      threshold_id
    } = body;

    if (!questionnaire_id || scoring_min === undefined || !interpretation || !recommendation) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    // Validate min and max values
    const min = parseInt(scoring_min);
    const max = scoring_max !== undefined ? parseInt(scoring_max) : 999999;
    
    if (min > max) {
      return {
        statusCode: 400,
        message: "Minimum score cannot be greater than maximum score",
      };
    }

    const now = new Date();

    if (threshold_id) {
      // Update existing threshold
      const updatedThreshold = await prisma.questionnaire_scoring.update({
        where: {
          scoring_ID: threshold_id,
        },
        data: {
          scoring_questionnaires: questionnaire_id,
          scoring_min: min,
          scoring_max: max,
          scoring_interpretation: interpretation,
          scoring_recommendation: recommendation,
          updated_at: now,
        },
      });

      return {
        statusCode: 200,
        message: "Threshold updated successfully",
        data: updatedThreshold,
      };
    } else {
      // Create new threshold
      const newThreshold = await prisma.questionnaire_scoring.create({
        data: {
          scoring_questionnaires: questionnaire_id,
          scoring_min: min,
          scoring_max: max,
          scoring_interpretation: interpretation,
          scoring_recommendation: recommendation,
          created_at: now,
          updated_at: now,
        },
      });

      return {
        statusCode: 201,
        message: "Threshold created successfully",
        data: newThreshold,
      };
    }
  } catch (error) {
    console.error('Error creating/updating threshold:', error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
    };
  }
}

// DELETE handler - delete a threshold
async function handleDelete(event) {
  try {
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const query = getQuery(event);
    const { threshold_id } = query;

    if (!threshold_id) {
      return {
        statusCode: 400,
        message: "Missing required parameter: threshold_id",
      };
    }

    // Soft delete by updating the deleted_at field
    await prisma.questionnaire_scoring.update({
      where: {
        scoring_ID: parseInt(threshold_id),
      },
      data: {
        deleted_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Threshold deleted successfully",
    };
  } catch (error) {
    console.error('Error deleting threshold:', error);
    return {
      statusCode: 500,
      message: "Internal Server Error",
    };
  }
} 