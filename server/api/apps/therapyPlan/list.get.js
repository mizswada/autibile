export default defineEventHandler(async (event) => {
    try {
     
      const service = await prisma.service.findMany({
        select: {
          service_id: true,
          name: true,
          description: true,
          therapy_centerID: true,
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
  
      // Fetch therapy centers separately
      const therapyCenters = await prisma.therapyst_center.findMany({
        select: {
          center_ID: true,
          center_name: true,
        },
        where: {
          deleted_at: null
        }
      });
  
      // Create a map for quick lookup
      const centerMap = therapyCenters.reduce((map, center) => {
        map[center.center_ID] = center.center_name;
        return map;
      }, {});
   
      // Transform the data to match the expected format
      const transformedService = service.map((service, index) => ({
        no: index + 1,
        id: service.service_id,
        name: service.name,
        description: service.description,
        center_name: service.therapy_centerID ? (centerMap[service.therapy_centerID] || 'Center not found') : 'Not assigned'
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