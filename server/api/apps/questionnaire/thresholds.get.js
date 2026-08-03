export default defineEventHandler(async (event) => {
  try {
    const { questionnaireID } = getQuery(event);

    const whereClause = {
      deleted_at: null, // Filter out soft-deleted records
      hidden: { not: true }, // Filter out hidden questionnaires
    };

    if (questionnaireID) {
      whereClause.questionnaire_id = parseInt(questionnaireID);
    }

    const questionnaires = await prisma.questionnaires.findMany({
      where: whereClause,
      orderBy: { questionnaire_id: 'asc' },
      select: {
        questionnaire_id: true,
        title: true,
        questionnaire_scoring: {
          where: { deleted_at: null },
          orderBy: { scoring_min: 'asc' },
          select: {
            scoring_ID: true,
            scoring_min: true,
            scoring_max: true,
            scoring_interpretation: true,
            scoring_interpretation_bm: true,
            scoring_recommendation: true,
            scoring_recommendation_bm: true,
          },
        },
      },
    });

    // admin_recommendation is intentionally excluded: it is guidance for admin users only.
    const data = questionnaires
      .filter((q) => q.questionnaire_scoring.length > 0)
      .map((q) => ({
        questionnaire_id: q.questionnaire_id,
        title: q.title,
        thresholds: q.questionnaire_scoring.map((threshold) => ({
          threshold_id: threshold.scoring_ID,
          scoring_min: threshold.scoring_min,
          scoring_max: threshold.scoring_max,
          interpretation: threshold.scoring_interpretation,
          interpretation_bm: threshold.scoring_interpretation_bm,
          recommendation: threshold.scoring_recommendation,
          recommendation_bm: threshold.scoring_recommendation_bm,
        })),
      }));

    return {
      statusCode: 200,
      message: 'Success',
      data,
    };
  } catch (error) {
    console.error('GET /api/apps/questionnaire/thresholds error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
      error: error.message,
    };
  }
});
