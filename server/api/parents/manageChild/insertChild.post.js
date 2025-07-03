export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const {
      fullname,
      nickname,
      gender,
      icNumber,
      dateOfBirth,
      autismDiagnose,
      diagnosedDate,
      availableSession,
      status,
      parentID,
      userID,
    } = body;

    if (
      !nickname || !gender || !icNumber || !dateOfBirth || !autismDiagnose ||
      !diagnosedDate || !availableSession || !status || !parentID || !userID
    ) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    // Check if IC number already exists in user_patients
    const existingPatient = await prisma.user_patients.findFirst({
      where: { patient_ic: icNumber },
    });

    let patientID;

    if (existingPatient) {
      patientID = existingPatient.patient_id;
    } else {
      // Insert new patient if not exists
      const saved = await prisma.user_patients.create({
        data: {
          user_id: parseInt(userID), // parent's user ID
          fullname,
          nickname,
          gender,
          patient_ic: icNumber,
          dob: new Date(dateOfBirth),
          autism_diagnose: autismDiagnose,
          diagnosed_on: new Date(diagnosedDate),
          status,
          available_session: availableSession,
          created_at: new Date(),
        },
      });
      patientID = saved.patient_id;
    }

    // Check if link already exists
    const existingLink = await prisma.user_parent_patient.findFirst({
      where: {
        parent_id: parseInt(parentID),
        patient_id: patientID,
      },
    });

    if (existingLink) {
      return {
        statusCode: 409,
        message: "This child is already linked to this parent",
      };
    }

    // Insert into user_parent_patient table if not linked yet
    const parentPatientLink = await prisma.user_parent_patient.create({
      data: {
        parent_id: parseInt(parentID),
        patient_id: patientID,
      },
    });

    return {
      statusCode: 200,
      message: existingPatient
        ? "Existing child linked to parent successfully"
        : "New child added and linked to parent successfully",
      data: {
        patientID,
        parentPatientLink,
      },
    };

  } catch (error) {
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
});
