export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const childID = parseInt(body.childID);
    const status = body.status;
  
    if (!childID || !status) {
      return { statusCode: 400, message: 'Missing child ID or status' };
    }
  
    try {
      await prisma.user_patients.update({
        where: { patient_id: childID },
        data: { status: status },
      });
  
      return { statusCode: 200, message: 'Status updated' };
    } catch (err) {
      console.error('Status update failed:', err);
      return { statusCode: 500, message: 'Internal server error' };
    }
  });
  