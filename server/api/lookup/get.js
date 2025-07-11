// Added by: Firzana Huda
export default defineEventHandler(async (event) => {
  const { lookupID } = getQuery(event);

  if (!lookupID) {
    return { statusCode: 400, message: 'Missing lookup ID' };
  }

  try {
    const lookup = await prisma.lookup.findUnique({
      where: { lookupID: parseInt(lookupID) },
    });

    if (!lookup) {
      return {
        statusCode: 404,
        message: 'Lookup not found',
      };
    }

    return {
      statusCode: 200,
      message: 'Success',
      data: lookup,
    };
  } catch (error) {
    console.error('Error fetching lookup:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
    };
  }
}); 