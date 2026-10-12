export default defineEventHandler(async (event) => {
    if (!event.context.user?.userID) {
        return { statusCode: 401, message: "Unauthorized: please log in." };
    }
    const { id } = getQuery(event);    
    try { 
        const user = await prisma.user.findFirst({
            where: {
                userEmail: id
            }
        });     

        if (user) {
            return {
                statusCode: 200,
                message: "User found",
                data: user.userID
            };
        } else {
            return {
                statusCode: 404,
                message: "User not found",
                data: null
            };
        }
        
    } catch (error) {
        console.error("Error fetching user:", error);
        return {
            response: 500,
            success: false,
            error: "Failed to fetch user",
        };
    }
});