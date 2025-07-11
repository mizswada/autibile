export default defineEventHandler(async (event) => {
  try {
   
    const service = await prisma.service.findMany({
      select: {
        service_id: true,
        name: true,
        description: true,    
      },
      where: {
        deleted_at: null
      },
      orderBy: {
        service_id: 'asc'
      }
    });
 
    if (!service || service.length === 0) {
      return [];
    }
 
    // Transform the data to match the expected format
    const transformedService = service.map((service, index) => ({
      no: index + 1,
      name: service.name,
      description: service.description,
    }));
 
    return transformedService;
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});