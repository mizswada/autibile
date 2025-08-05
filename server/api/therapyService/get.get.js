export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { id } = query;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing service ID",
      };
    }

    const service = await prisma.service.findFirst({
      select: {
        service_id: true,
        name: true,
        description: true,
        therapy_centerID: true,
      },
      where: {
        service_id: parseInt(id),
        deleted_at: null
      }
    });

    if (!service) {
      return {
        statusCode: 404,
        message: "Service not found",
      };
    }

    return {
      statusCode: 200,
      data: {
        id: service.service_id,
        name: service.name,
        description: service.description,
        therapy_centerID: service.therapy_centerID,
      }
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 