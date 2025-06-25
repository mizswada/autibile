// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {
    // Extract userID from the session context
    const { userID } = event.context.user || {};
    if (!userID) {
      return {
        statusCode: 401,
        message: "Unauthorized: Missing user session",
      };
    }

    const body = await readBody(event);

    const {
      nickname,
      gender,
      dateOfBirth,
      autismDiagnose,
      diagnosedDate,
      availableSession,
      status,
      parentID,
    } = body;

    // Basic validation
    if (
        !nickname || !gender || !dateOfBirth || !autismDiagnose || !diagnosedDate 
        || !availableSession || !status || !parentID
      ) {
        return {
          statusCode: 400,
          message: "Missing required fields",
        };
      }

    // Save to DB
    const saved = await prisma.user_patients.create({
      data: {
        user_id: parseInt(userID),
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
    console.log("Saved patient:", saved);
    // Get the ID of the newly inserted patient
    const patientID = saved.patient_id;
    console.log("patientID", patientID);

    // Save relationship to user_parent_patient
    const savedRelations = await prisma.user_parent_patient.create({
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

  