// Added by: Assistant - Update MCHAT-R Status API
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
    const { patientId, mchatrStatus } = body;

    if (!patientId || !mchatrStatus) {
      return {
        statusCode: 400,
        message: "Patient ID and MCHAT-R status are required",
      };
    }

    // Validate status values
    if (!['Enable', 'Disable'].includes(mchatrStatus)) {
      return {
        statusCode: 400,
        message: "MCHAT-R status must be either 'Enable' or 'Disable'",
      };
    }

    // Check if patient exists
    const existingPatient = await prisma.user_patients.findUnique({
      where: {
        patient_id: parseInt(patientId)
      }
    });

    if (!existingPatient) {
      return {
        statusCode: 404,
        message: "Patient not found",
      };
    }

    // Update the patient's MCHAT-R status
    const updatedPatient = await prisma.user_patients.update({
      where: {
        patient_id: parseInt(patientId)
      },
      data: {
        mchatr_status: mchatrStatus,
        update_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: `MCHAT-R status updated to ${mchatrStatus}`,
      data: {
        patient_id: updatedPatient.patient_id,
        fullname: updatedPatient.fullname,
        mchatr_status: updatedPatient.mchatr_status
      }
    };

  } catch (error) {
    console.error("Error updating MCHAT-R status:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
    };
  }
}); 