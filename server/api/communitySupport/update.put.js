import { DateTime } from "luxon";

export default defineEventHandler(async (event) => {
  try {
    console.log('event - edit');
    const query = getQuery(event);
    const body = await readBody(event);

    const { id } = query;
    const { community_author, community_title, community_content} = body;

    if (!id) {
      return {
        statusCode: 400,
        message: "Missing community ID",
      };
    }

    if (!community_author || !community_title || !community_content ) {
      return {
        statusCode: 400,
        message: "Missing required fields",
      };
    }
    // alert(JSON.stringify(id));
    // Update centre record
    const updatedPost = await prisma.community.update({
      where: {
        community_id: parseInt(id)
      },
      data: {
       community_author: community_author,
       community_title: community_title,
       community_content: community_content,
       updated_at: DateTime.now().toISO(),
      },
    });

    if (!updatedPost) {
      return {
        statusCode: 400,
        message: "Failed to update post",
      };
    }

    return {
      statusCode: 200,
      message: "Post updated successfully",
      data: updatedPost,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 