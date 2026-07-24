export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const body = await readBody(event);

    const { id } = query;
    const {
      techSupport_name,
      techSupport_email,
      techSupport_phone,
      techSupport_status,
    } = body;

    const techSupportId = parseInt(id, 10);

    if (!id || Number.isNaN(techSupportId)) {
      return {
        statusCode: 400,
        message: "Missing or invalid tech support ID",
      };
    }

    if (
      !techSupport_name ||
      !techSupport_email ||
      !techSupport_phone ||
      !techSupport_status
    ) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }

    const updatedTechSupport = await prisma.tech_supports.update({
      where: {
        techSupport_ID: techSupportId,
      },
      data: {
        techSupport_name: String(techSupport_name).trim(),
        techSupport_email: String(techSupport_email).trim(),
        techSupport_phone: String(techSupport_phone).trim(),
        techSupport_status: String(techSupport_status).trim(),
        updated_at: new Date(),
      },
    });

    if (!updatedTechSupport) {
      return {
        statusCode: 400,
        message: "Failed to update tech support contact",
      };
    }

    return {
      statusCode: 200,
      message: "Tech support contact updated successfully",
      data: {
        id: updatedTechSupport.techSupport_ID,
        techSupport_name: updatedTechSupport.techSupport_name,
        techSupport_email: updatedTechSupport.techSupport_email,
        techSupport_phone: updatedTechSupport.techSupport_phone,
        techSupport_status: updatedTechSupport.techSupport_status,
      },
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: error?.message || "Server error",
    };
  }
});
