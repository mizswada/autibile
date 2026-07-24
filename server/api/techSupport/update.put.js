import { DateTime } from "luxon";

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

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing tech support ID",
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
        techSupport_ID: parseInt(id),
      },
      data: {
        techSupport_name,
        techSupport_email,
        techSupport_phone,
        techSupport_status,
        updated_at: DateTime.now().toISO(),
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
      data: updatedTechSupport,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});
