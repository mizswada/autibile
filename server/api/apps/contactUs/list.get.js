export default defineEventHandler(async () => {
  try {
    // Use raw SQL — Prisma findMany with deleted_at: null fails when the table
    // has legacy zero-date timestamps (MySQL error 1525). Do not SELECT deleted_at.
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

    return techSupport.map((item, index) => ({
      no: index + 1,
      name: item.techSupport_name,
      email: item.techSupport_email,
      phoneNumber: item.techSupport_phone,
      status: item.techSupport_status,
    }));
  } catch (error) {
    console.log("apps/contactUs/list error:", error);
    return {
      statusCode: 500,
      message: error?.message || "Server error",
    };
  }
});
