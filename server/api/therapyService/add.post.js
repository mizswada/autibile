import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('body', body);
    const { user } = event.context.user;
 
    const { name, description, therapy_centerID } = body;
 
    if (!name || !description) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
 
 
 
    // Create centre record
    const therapyService = await prisma.service.create({
      data: {
        name: name,
        description: description,
        therapy_centerID: therapy_centerID ? parseInt(therapy_centerID) : null,
        created_at: DateTime.now().toISO(),
        updated_at: DateTime.now().toISO(),
      },
    });
 
    if (!therapyService) {
      return {
        statusCode: 400,
        message: "Failed to create service",
      };
    }
 
    return {
      statusCode: 200,
      message: "service added successfully",
      data: therapyService,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});