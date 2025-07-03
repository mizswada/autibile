import prisma from "@@/server/config/prisma-client"

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
 
    const centre = await prisma.therapyst_centre.findFirst({
      where: {
        centre_id: parseInt(centreID),
      },
      select: {
        centre_id: true,
        centre_name: true,
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
      centreID: centre.center_id,
      centreName: centre.center_name,
      centerPhone: centre.center_phone,
      centerAddress: centre.center_address,
      centerLocation: centre.center_location,
      createdDate: centre.created_at,
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
  
