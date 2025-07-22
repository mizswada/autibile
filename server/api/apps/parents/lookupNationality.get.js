// Added by: Firzana Huda 24 June 2025
export default defineEventHandler(async (event) => {
  try {

    // Fetch nationality values from the 'lookup' table
    const nationality = await prisma.lookup.findMany({
      where: {
        refCode: 'nationality',
      },
      select: {
        lookupID: true,
        title: true,
      },
    });

    return nationality; 
  } catch (error) {
    console.error('Nationality fetch error:', error);
    return {
      statusCode: 500,
      message: 'Internal Server Error',
    };
  }
});
  
  