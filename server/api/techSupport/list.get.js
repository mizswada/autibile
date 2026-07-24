export default defineEventHandler(async (event) => {
  try {
    // Avoid comparing deleted_at to '0000-00-00' — MySQL strict mode throws 1525.
    // Do not SELECT deleted_at either, so zero-dates in that column don't break the query.
    const techSupport = await prisma.$queryRaw`
      SELECT
        techSupport_ID,
        techSupport_name,
        techSupport_email,
        techSupport_phone,
        techSupport_status
      FROM tech_supports
      ORDER BY techSupport_ID ASC
    `;

    if (!techSupport || techSupport.length === 0) {
      return [];
    }

    return techSupport.map((item, index) => {
      const id = Number(item.techSupport_ID);
      return {
        no: index + 1,
        supportType: item.techSupport_name,
        contact: item.techSupport_phone,
        status: item.techSupport_status,
        action: "edit",
        id,
        isDefault: id === 1,
        techSupport_name: item.techSupport_name,
        techSupport_email: item.techSupport_email,
        techSupport_phone: item.techSupport_phone,
        techSupport_status: item.techSupport_status,
      };
    });
  } catch (error) {
    console.log("techSupport list error:", error);
    return {
      statusCode: 500,
      message: error?.message || "Server error",
    };
  }
});
