export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { user } = event.context.user;
    const centreID = query.centreID;
 
    if (!centreID) {
      return {
        statusCode: 400,
        message: "Centre ID is required",
      };
    }
 
    const centre = await prisma.therapyst_center.findFirst({
      where: {
        center_id: parseInt(centreID),
      },
      select: {
        center_id: true,
        center_name: true,
        center_phone: true,
        center_address: true,
        center_location: true,
        created_at: true,
      },
    });
 
    if (!centre) {
      return {
        statusCode: 400,
        message: "Centre not found",
      };
    }
 
    // Transform the data to match the expected format
    const autismCentre = {
      center_id: centre.center_id,
      center_name: centre.center_name,
      center_phone: centre.center_phone,
      center_address: centre.center_address,
      center_location: centre.center_location,
      created_at: centre.created_at,
    };
 
    return {
      statusCode: 200,
      message: "Centre found",
      data: autismCentre,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});

  
