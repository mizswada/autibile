export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const {
      patientID,
      description,
      two_way_communication,
      emotional_regulation,
      focus_and_comprehension,
      feeding_and_sensory,
      sleep_and_daily_routines,
      socialisation_self_confidence,
      date,
    } = body;

    if (!patientID) {
      return {
        statusCode: 400,
        message: "Missing required field: patientID",
      };
    }

    const categories = [
      two_way_communication,
      emotional_regulation,
      focus_and_comprehension,
      feeding_and_sensory,
      sleep_and_daily_routines,
      socialisation_self_confidence,
    ];
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
        two_way_communication: two_way_communication?.trim() || null,
        emotional_regulation: emotional_regulation?.trim() || null,
        focus_and_comprehension: focus_and_comprehension?.trim() || null,
        feeding_and_sensory: feeding_and_sensory?.trim() || null,
        sleep_and_daily_routines: sleep_and_daily_routines?.trim() || null,
        socialisation_self_confidence:
          socialisation_self_confidence?.trim() || null,
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
