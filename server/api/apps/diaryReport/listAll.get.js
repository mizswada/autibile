export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { patientId, parentId, startDate, endDate, limit = 50, offset = 0 } = query;

    // Build where clause based on query parameters
    const whereClause = {
      deleted_at: null // Only include non-deleted diary reports
    };

    // Filter by patient ID if provided
    if (patientId) {
      whereClause.patient_id = parseInt(patientId);
    }

    // Filter by parent ID if provided (get all children of that parent)
    if (parentId) {
      // Get all patient IDs that belong to this parent
      const parentChildren = await prisma.user_parent_patient.findMany({
        where: {
          parent_id: parseInt(parentId)
        },
        select: {
          patient_id: true
        }
      });
      
      const childPatientIds = parentChildren.map(child => child.patient_id);
      
      if (childPatientIds.length > 0) {
        whereClause.patient_id = {
          in: childPatientIds
        };
      } else {
        // If parent has no children, return empty result
        return {
          statusCode: 200,
          message: "No children found for this parent",
          data: [],
          pagination: {
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: false
          }
        };
      }
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      whereClause.date = {};
      
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      
      if (endDate) {
        whereClause.date.lte = new Date(endDate);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.diary_report.count({
      where: whereClause
    });

    // Fetch diary reports with patient information
    const diaryReports = await prisma.diary_report.findMany({
      where: whereClause,
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
            available_session: true,
            created_at: true,
            update_at: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { created_at: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Format the response data
    const formattedReports = diaryReports.map(report => ({
      diary_id: report.diary_id,
      patient_id: report.patient_id,
      description: report.description,
      date: report.date,
      created_at: report.created_at,
      updated_at: report.updated_at,
      patient: report.user_patients ? {
        patient_id: report.user_patients.patient_id,
        fullname: report.user_patients.fullname,
        nickname: report.user_patients.nickname,
        patient_ic: report.user_patients.patient_ic,
        gender: report.user_patients.gender,
        dob: report.user_patients.dob,
        autism_diagnose: report.user_patients.autism_diagnose,
        diagnosed_on: report.user_patients.diagnosed_on,
        status: report.user_patients.status,
        available_session: report.user_patients.available_session,
        created_at: report.user_patients.created_at,
        update_at: report.user_patients.update_at
      } : null
    }));

    // Calculate pagination info
    const hasMore = (parseInt(offset) + parseInt(limit)) < totalCount;

    return {
      statusCode: 200,
      message: "Diary reports fetched successfully",
      data: formattedReports,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: hasMore
      }
    };

  } catch (error) {
    console.error("Error fetching diary reports:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 