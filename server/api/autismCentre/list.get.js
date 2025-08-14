export default defineEventHandler(async (event) => {
  try {
   
    const centres = await prisma.therapyst_center.findMany({
      select: {
        center_ID: true,
        center_name: true,
        center_phone: true,
        center_address: true,
        center_location: true,
        center_logo: true,       
      },
      where: {
        deleted_at: null
      },
      orderBy: {
        center_ID: 'asc'
      }
    });
 
    if (!centres || centres.length === 0) {
      return [];
    }
 
    // Transform the data to match the expected format
    const transformedCentres = centres.map((centre, index) => ({
      no: index + 1,
      id: centre.center_ID, // Add this line for frontend compatibility
      center_ID: centre.center_ID,
      center_name: centre.center_name,
      center_phone: centre.center_phone,
      center_address: centre.center_address,
      center_location: centre.center_location,
      center_logo: centre.center_logo,
    }));
 
    return transformedCentres;
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});
