import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('body', body);
    const { user } = event.context.user;
 
    const { community_author, community_title, community_content,  } = body;
 
    if (!community_author || !community_title || !community_content ) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
 
 
 
    // Create post record
    const communityPost = await prisma.community.create({
      data: {
       community_author: community_author,
       community_title: community_title,
       community_content: community_content,
       created_at: DateTime.now().toISO(),
       updated_at: DateTime.now().toISO(),
      },
    });
 
    if (!communityPost) {
      return {
        statusCode: 400,
        message: "Failed to create post",
      };
    }
 
    return {
      statusCode: 200,
      message: "Post added successfully",
      data: communityPost,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});