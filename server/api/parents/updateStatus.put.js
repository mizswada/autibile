export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const parentID = parseInt(body.parentID);
    const status = body.status;
  
    if (!parentID || !status) {
      return { statusCode: 400, message: 'Missing parent ID or status' };
    }
  
    try {
      await prisma.user_parents.update({
        where: { parent_id: parentID },
        data: { parent_status: status },
      });
  
      return { statusCode: 200, message: 'Status updated' };
    } catch (err) {
      console.error('Status update failed:', err);
      return { statusCode: 500, message: 'Internal server error' };
    }
  });
  