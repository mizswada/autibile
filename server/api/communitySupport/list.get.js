export default defineEventHandler(async (event) => {
  try {
   
    const post = await prisma.community.findMany({
      select: {
       community_id: true,
       community_author: true,
       community_title: true,
       community_content: true,   
      },
      where: {
        deleted_at: null
      },
      orderBy: {
        community_id: 'asc'
      }
    });
 
    if (!post || post.length === 0) {
      return [];
    }
 
    // Transform the data to match the expected format
    const transformedPost = post.map((post, index) => ({
      no: index + 1,
      id: post.community_id,
      author: post.community_author,
      title: post.community_title,
      content: post.community_content,
    }));
 
    return transformedPost;
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});