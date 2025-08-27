export default defineEventHandler(async (event) => {
  try {
    // Fetch bank values from the 'lookup' table
    const banks = await prisma.lookup.findMany({
      where: {
        refCode: 'bankName',
        status: 'enable'
      },
      select: {
        lookupID: true,
        title: true,
        value: true
      },
      orderBy: {
        lookupOrder: 'asc'
      }
    });

    if (!banks || banks.length === 0) {
      // If no active banks found, try without status filter
      const allBanks = await prisma.lookup.findMany({
        where: {
          refCode: 'bankName',
        },
        select: {
          lookupID: true,
          title: true,
          value: true
        }
      });
      
      // Return all banks if no active ones found
      return allBanks;
    }

    return banks;
  } catch (error) {
    console.error('Error fetching bank options:', error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});
