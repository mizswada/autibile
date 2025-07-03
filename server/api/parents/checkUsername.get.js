export default defineEventHandler(async (event) => {
    const { username } = getQuery(event);
  
    if (!username) {
      return {
        statusCode: 400,
        message: "Username is required",
      };
    }
  
    const user = await prisma.user.findFirst({
      where: { userUsername: username },
    });
  
    if (user) {
      return {
        statusCode: 409,
        message: "Username already exists",
      };
    }
  
    return {
      statusCode: 200,
      message: "Username is available",
    };
  });
  