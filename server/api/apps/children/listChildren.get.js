export default defineEventHandler(async (event) => {
    try {
      const query = getQuery(event);
      const parentID = query.parentID;
  
      if (!parentID) {
        return {
          statusCode: 400,
          message: "Missing required query parameter: parentID",
        };
      }
  
      const children = await prisma.user_parent_patient.findMany({
        where: {
          parent_id: parseInt(parentID),
        },
        include: {
          user_patients: {
            select: {
              patient_id: true,
              fullname: true,
              nickname: true,
              patient_ic: true,
              gender: true,
              dob: true,
              autism_diagnose: true,
              diagnosed_on: true,
              status: true,
              created_at: true,
              update_at: true,
            },
          },
        },
        orderBy: {
          user_patients: {
            created_at: 'desc',
          },
        },
      });

      // Transform the data to match expected format
      const transformedChildren = children.map(child => ({
        patient_id: child.user_patients.patient_id,
        patient_name: child.user_patients.fullname,
        patient_dob: child.user_patients.dob,
        patient_gender: child.user_patients.gender,
        created_at: child.user_patients.created_at,
        updated_at: child.user_patients.update_at,
        // Additional fields that might be useful
        nickname: child.user_patients.nickname,
        patient_ic: child.user_patients.patient_ic,
        autism_diagnose: child.user_patients.autism_diagnose,
        diagnosed_on: child.user_patients.diagnosed_on,
        status: child.user_patients.status,
      }));
  
      return {
        statusCode: 200,
        message: "Children fetched successfully",
        data: transformedChildren,
      };
    } catch (error) {
      console.error("Error fetching children:", error);
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  