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
        deleted_at: null
      },
      orderBy: {
        techSupport_ID: 'asc'
      }
    });
 
    if (!techSupport || techSupport.length === 0) {
      return [];
    }
 
    // Transform the data to match the expected format
    const transformedTechSupport = techSupport.map((techSupport, index) => ({
      no: index + 1,
      name: techSupport.techSupport_name,
      email: techSupport.techSupport_email,
      phoneNumber: techSupport.techSupport_phone,
      status:techSupport.techSupport_status,
    }));
 
    return transformedTechSupport;
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});