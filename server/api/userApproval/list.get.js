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
  
      const practitioners = await prisma.user_practitioners.findMany({
        where: {
          deleted_at: null, // Filter out soft-deleted records
          status: 'Pending', // Only show pending status
        },
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              userUsername: true,
              userFullName: true,
              userEmail: true,
              userPhone: true,
              userIC: true,
            },
          },
        },
      });

      // Fetch department lookup information
      const departmentLookups = await prisma.lookup.findMany({
        where: {
          type: 'department', // Assuming department type
        },
        select: {
          lookupID: true,
          title: true,
          value: true,
        },
      });

      // Create a map for quick lookup
      const departmentMap = {};
      departmentLookups.forEach(dept => {
        departmentMap[dept.lookupID] = dept.title || dept.value;
      });      
  
      const formattedPractitioners = practitioners.map(p => ({
        practitionerID: p.practitioner_id,
        userID: p.user_id,
        username: p.user?.userUsername || '',
        fullName: p.user?.userFullName || '',
        email: p.user?.userEmail || '',
        type: p.type || '',
        registrationNo: p.registration_no || '',
        phone: p.user?.userPhone || '',
        ic: p.user?.userIC || '',
        specialty: p.specialty || '',
        department: p.department ? departmentMap[p.department] || p.department : '',
        workplace: p.workplace || '',
        qualification: p.qualifications || '',
        experience: p.experience_years || '',
        signature: p.signature || '',
        status: p.status || '',
      }));
  
      return {
        statusCode: 200,
        message: 'Success',
        data: formattedPractitioners,
      };
  
    } catch (error) {
      console.error('GET /api/practitioners/listPractitioners error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message
      };
    }
  });
  