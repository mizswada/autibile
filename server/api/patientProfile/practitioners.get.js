export default defineEventHandler(async (event) => {
  try {
    // Fetch practitioners from lookup table where refCode is referal_practitioners
    const practitioners = await prisma.lookup.findMany({
      where: {
        refCode: 'referal_practitioners',
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

    if (!practitioners || practitioners.length === 0) {
      // If no active practitioners found, try without status filter
      const allPractitioners = await prisma.lookup.findMany({
        where: {
          refCode: 'referal_practitioners',
        },
        select: {
          lookupID: true,
          title: true,
          value: true
        }
      });
      
      // As a fallback, return some default options
      if (allPractitioners.length === 0) {
        return [
          { value: 1, label: 'Consultant Paediatrician' },
          { value: 2, label: 'Speech-Language Therapist' }
        ];
      }
      
      // Use all practitioners if no active ones found
      const fallbackOptions = allPractitioners.map(practitioner => ({
        value: practitioner.lookupID,
        label: practitioner.title
      }));
      
      return fallbackOptions;
    }

    // Transform to format suitable for dropdown
    const practitionerOptions = practitioners.map(practitioner => ({
      value: practitioner.lookupID,
      label: practitioner.title
    }));

    return practitionerOptions;
  } catch (error) {
    console.log('Error fetching practitioner options:', error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});