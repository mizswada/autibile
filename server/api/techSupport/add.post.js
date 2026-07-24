export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const {
      techSupport_name,
      techSupport_email,
      techSupport_phone,
      techSupport_status,
    } = body;

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

    const now = new Date();

    const created = await prisma.tech_supports.create({
      data: {
        techSupport_name: String(techSupport_name).trim(),
        techSupport_email: String(techSupport_email).trim(),
        techSupport_phone: String(techSupport_phone).trim(),
        techSupport_status: String(techSupport_status).trim(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    });

    if (!created) {
      return {
        statusCode: 400,
        message: "Failed to create tech support contact",
      };
    }

    return {
      statusCode: 200,
      message: "Tech support contact added successfully",
      data: {
        id: created.techSupport_ID,
        techSupport_name: created.techSupport_name,
        techSupport_email: created.techSupport_email,
        techSupport_phone: created.techSupport_phone,
        techSupport_status: created.techSupport_status,
      },
    };
  } catch (error) {
    console.log("techSupport add error:", error);
    return {
      statusCode: 500,
      message: error?.message || "Server error",
    };
  }
});
