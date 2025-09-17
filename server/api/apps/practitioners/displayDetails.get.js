export default defineEventHandler(async (event) => {
    try {
      const query = getQuery(event);
      const practitionerID = query.practitionerID;
  
      const practitioners = await prisma.user_practitioners.findMany({
        where: {
          deleted_at: null, // Filter out soft-deleted records
          status: {
            notIn: ['Pending', 'Rejected'], // Exclude both statuses
          },
          practitioner_id: parseInt(practitionerID)
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
        department: p.department || '',
        qualification: p.qualifications || '',
        experience: p.experience_years || '',
        signature: p.signature || '',
        status: p.status || '',
        workplace: p.workplace || '',
      }));
  
      return {
        statusCode: 200,
        message: 'Success',
        data: formattedPractitioners,
      };
  
    } catch (error) {
      console.error('GET /api/apps/practitioners/displayDetails error:', error);
      return {
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message
      };
    }
  });
  