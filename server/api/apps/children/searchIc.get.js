export default defineEventHandler(async (event) => {
    const { icNumber } = getQuery(event);
  
    if (!icNumber) {
      return {
        statusCode: 400,
        message: 'IC Number is required',
      };
    }
  
    try {
      const users = await prisma.user_patients.findMany({
        where: {
          patient_ic: icNumber,
        },
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
          available_session: true,
          OKUCard: true,
          treatment_type: true,
        },
      });
  
      if (!users.length) {
        return {
          statusCode: 404,
          message: 'No user found with this IC number',
        };
      }
  
      // Map DB fields to frontend-friendly keys
      const mappedUsers = users.map(u => ({
        userID: u.patient_id,
        fullname: u.fullname,
        nickname: u.nickname,
        icNumber: u.patient_ic,
        gender: u.gender,
        dateOfBirth: u.dob ? new Date(u.dob).toISOString().split('T')[0] : '',
        autismDiagnose: u.autism_diagnose,
        diagnosedDate: u.diagnosed_on ? new Date(u.diagnosed_on).toISOString().split('T')[0] : '',
        status: u.status,
        availableSession: u.available_session,
        okuCard: u.OKUCard,
        treatmentType: u.treatment_type,
      }));
  
      return {
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: mappedUsers,
      };
    } catch (err) {
      return {
        statusCode: 500,
        message: 'Server error while searching IC',
      };
    }
  });
  