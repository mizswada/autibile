export default defineEventHandler(async (event) => {
  try {
    const techSupport = await prisma.tech_supports.findMany({
      select: {
        techSupport_ID: true,
        techSupport_name: true,
        techSupport_email: true,
        techSupport_phone: true,
        techSupport_status: true,
      },
      where: {
        deleted_at: null,
      },
      orderBy: {
        techSupport_ID: "asc",
      },
    });

    if (!techSupport || techSupport.length === 0) {
      return [];
    }

    return techSupport.map((item, index) => ({
      no: index + 1,
      id: item.techSupport_ID,
      techSupport_name: item.techSupport_name,
      techSupport_email: item.techSupport_email,
      techSupport_phone: item.techSupport_phone,
      techSupport_status: item.techSupport_status,
    }));
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});
