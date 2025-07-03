import prisma from "@@/server/config/prisma-client"

import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { user } = event.context.user;
 
    const { center_name, center_phone, center_address, center_location } = body;
 
    if (!center_name || !center_phone || !center_address || !center_location) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
 
    // // Get the lookup ID for the status
    // const statusLookup = await prisma.lookup.findFirst({
    //   where: {
    //     lookupValue: status,
    //     lookupTitle: "Animal Status",
    //   },
    //   select: {
    //     lookupID: true,
    //   },
    // });
 
    // if (!statusLookup) {
    //   return {
    //     statusCode: 400,
    //     message: "Invalid status",
    //   };
    // }
 
    // Create animal record
    const autismCenter = await prisma.therapyst_center.create({
      data: {
        center_id: user.centerID,
        center_name: center_name,
        center_phone: phone,
        center_address: address,
        center_location: location,
        created_at: DateTime.now().toISO(),
      },
    });
 
    if (!autismCenter) {
      return {
        statusCode: 400,
        message: "Failed to create center",
      };
    }
 
    return {
      statusCode: 200,
      message: "Center added successfully",
      data: autismCenter,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});

