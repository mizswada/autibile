export default defineEventHandler(async (event) => {
    try {
      const query = getQuery(event);
      const patientID = query.patientID;
  
      if (!patientID) {
        return {
          statusCode: 400,
          message: "Missing required query parameter: patientID",
        };
      }
  
      const diaryReports = await prisma.diary_report.findMany({
        where: {
          patient_id: parseInt(patientID),
        },
        orderBy: {
          date: 'desc',
        },
        select: {
          diary_id: true,
          description: true,
          date: true,
          created_at: true,
          updated_at: true,
        },
      });
  
      return {
        statusCode: 200,
        message: "Diary reports fetched successfully",
        data: diaryReports,
      };
    } catch (error) {
      console.error(error);
      return {
        statusCode: 500,
        message: "Internal server error",
      };
    }
  });
  