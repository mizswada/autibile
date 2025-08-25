export default defineEventHandler(async (event) => {
  try {
    // Fetch departments from lookup table where refCode is 'Department'
    const departments = await prisma.lookup.findMany({
      where: {
        refCode: 'Department',
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

    if (!departments || departments.length === 0) {
      // If no active departments found, try without status filter
      const allDepartments = await prisma.lookup.findMany({
        where: {
          refCode: 'Department',
        },
        select: {
          lookupID: true,
          title: true,
          value: true
        }
      });
      
      // Return all departments if no active ones found
      return allDepartments;
    }

    return departments;
  } catch (error) {
    console.log('Error fetching department options:', error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
});
