export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const parentID = parseInt(query.parentID);

    if (!parentID) {
      return {
        statusCode: 400,
        message: 'Missing parent ID',
      };
    }

    const relations = await prisma.user_parent_patient.findMany({
      where: { parent_id: parentID },
      include: { user_patients: true }
    });

    const transformed = relations.map(r => {
      const c = r.user_patients;
      return {
        childID: c.patient_id,
        parentID: r.parent_id,
        nickname: c.nickname,
        gender: c.gender,
        autismDiagnose: c.autism_diagnose,
        diagnosedDate: c.diagnosed_on,
        availableSession: c.available_session,
        status: c.status,
      };
    });

    return {
      statusCode: 200,
      message: 'Success',
      data: transformed,
    };
  } catch (error) {
    console.error('GET /listChild error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
