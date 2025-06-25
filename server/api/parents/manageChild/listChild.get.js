// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
    try {
      const { userID } = event.context.user;
  
      if (!userID) {
        return {
          statusCode: 401,
          message: 'Unauthorized',
        };
      }
  
      const validatedUser = await prisma.user.findFirst({
        where: { userID: parseInt(userID) },
      });
  
      if (!validatedUser) {
        return {
          statusCode: 401,
          message: 'Unauthorized',
        };
      }
  
      const children = await prisma.user_patients.findMany({
        orderBy: { created_at: 'desc' },
      });
      
      const patientIDs = children.map(c => c.patient_id);
      
      const relations = await prisma.user_parent_patient.findMany({
        where: {
          patient_id: { in: patientIDs },
        },
      });
      
      const relationMap = Object.fromEntries(relations.map(r => [r.patient_id, r.parent_id]));
      
      const transformed = children.map(child => ({
        childID: child.patient_id,
        parentID: relationMap[child.patient_id] ?? '-',
        nickname: child.nickname,
        gender: child.gender,
        autismDiagnose: child.autism_diagnose,
        diagnosedDate: child.diagnosed_on,
        availableSession: child.available_session,
        status: child.status,
      }));
      
    //   console.log(transformed);
    //   console.log(children);

      return {
        statusCode: 200,
        message: 'Success',
        data: transformed,
      };
  
    } catch (error) {
      console.error('GET /api/parents/manageChild/listChild error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
      };
    }
  });
  