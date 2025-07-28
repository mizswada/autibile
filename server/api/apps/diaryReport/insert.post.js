export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { patientID, description, date } = body;

    if (!patientID || !description) {
      return {
        statusCode: 400,
        message: "Missing required fields: patientID and description",
      };
    }

    const newDiaryReport = await prisma.diary_report.create({
      data: {
        patient_id: parseInt(patientID),
        description: description,
        date: date ? new Date(date) : new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      statusCode: 200,
      message: "Diary report created successfully",
      data: newDiaryReport,
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
