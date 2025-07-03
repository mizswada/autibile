export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const parentID = query.parentID ? parseInt(query.parentID) : null;

    let relations;

    if (parentID) {
      // Get children for specific parent
      relations = await prisma.user_parent_patient.findMany({
        where: { parent_id: parentID },
        include: {
          user_patients: true,
          user_parents: {
            include: {
              user: true // include user to get username
            }
          }
        }
      });
    } else {
      // Get all children with their parent
      relations = await prisma.user_parent_patient.findMany({
        include: {
          user_patients: true,
          user_parents: {
            include: {
              user: true
            }
          }
        }
      });
    }

    const transformed = relations.map(r => {
      const c = r.user_patients;
      const p = r.user_parents;
      return {
        childID: c.patient_id,
        parentID: r.parent_id,
        parentUsername: p.user?.userUsername || '', // <-- add parent username here
        fullname: c.fullname || '',
        nickname: c.nickname,
        icNumber: c.patient_ic,
        gender: c.gender,
        dateOfBirth: c.dob,
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
