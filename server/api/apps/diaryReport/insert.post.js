export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const {
      patientID,
      description,
      category_1,
      category_2,
      category_3,
      category_4,
      category_5,
      date,
    } = body;

    if (!patientID) {
      return {
        statusCode: 400,
        message: "Missing required field: patientID",
      };
    }

    const categories = [category_1, category_2, category_3, category_4, category_5];
    const hasAtLeastOneCategory = categories.some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    if (!hasAtLeastOneCategory) {
      return {
        statusCode: 400,
        message: "At least one category field must be filled",
      };
    }

    const newDiaryReport = await prisma.diary_report.create({
      data: {
        patient_id: parseInt(patientID),
        description: description?.trim() || null,
        category_1: category_1?.trim() || null,
        category_2: category_2?.trim() || null,
        category_3: category_3?.trim() || null,
        category_4: category_4?.trim() || null,
        category_5: category_5?.trim() || null,
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
