export default defineEventHandler(async (event) => {
  try {
    // Fetch reasons from lookup table where refCode is referal_reason
    const reasons = await prisma.lookup.findMany({
      where: {
        refCode: 'referal_reason',
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

    if (!reasons || reasons.length === 0) {
      // If no active reasons found, try without status filter
      const allReasons = await prisma.lookup.findMany({
        where: {
          refCode: 'referal_reason',
        },
        select: {
          lookupID: true,
          title: true,
          value: true
        }
      });
      
      // As a fallback, return some default options
      if (allReasons.length === 0) {
        return [
          { value: 1, label: 'Assessment and intervention for speech and language delay' },
          { value: 2, label: 'Behavioural management' }
        ];
      }
      
      // Use all reasons if no active ones found
      const fallbackOptions = allReasons.map(reason => ({
        value: reason.lookupID,
        label: reason.title
      }));
      
      return fallbackOptions;
    }

    // Transform to format suitable for dropdown
    const reasonOptions = reasons.map(reason => ({
      value: reason.lookupID,
      label: reason.title
    }));

    return reasonOptions;
  } catch (error) {
    console.log('Error fetching reason options:', error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});