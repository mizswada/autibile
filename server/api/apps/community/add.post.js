import { getAppAuth } from "~/server/utils/appsAuth";
import { DateTime } from "luxon";
 
export default defineEventHandler(async (event) => {
  try {
    const auth = await getAppAuth(event, { role: "Any" });
    if (!auth.ok) {
      return { success: false, statusCode: auth.statusCode, message: auth.message };
    }

    const body = await readBody(event);

    const { user } = event.context.user;
 
    const { community_author, community_title, community_content, community_url } = body;
 
    // Create post record
    const communityPost = await prisma.community.create({
      data: {
       community_author: community_author,
       community_title: community_title,
       community_content: community_content,
       community_url: community_url,
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