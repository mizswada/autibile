export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
console.log("Raw body:", body);


    const {
      nickname,
      gender,
      dateOfBirth,
      autismDiagnose,
      diagnosedDate,
      availableSession,
      status,
      parentID,
      userID, // <-- Use this instead
    } = body;

    if (
      !nickname || !gender || !dateOfBirth || !autismDiagnose ||
      !diagnosedDate || !availableSession || !status || !parentID || !userID
    ) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    console.log(body);

    // Save to DB using the parent's userID
    const saved = await prisma.user_patients.create({
      data: {
        user_id: parseInt(userID), // <-- Parent's user ID
        nickname,
        gender,
        dob: new Date(dateOfBirth),
        autism_diagnose: autismDiagnose,
        diagnosed_on: new Date(diagnosedDate),
        status,
        available_session: availableSession,
        created_at: new Date(),
      },
    });

    const patientID = saved.patient_id;

    await prisma.user_parent_patient.create({
      data: {
        parent_id: parseInt(parentID),
        patient_id: patientID,
      },
    });

    return {
      statusCode: 200,
      message: "Child added successfully",
      data: saved,
    };

  } catch (error) {
    console.error("Error inserting child:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
