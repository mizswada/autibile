export default defineEventHandler(async (event) => {
  try {
    // Fetch languages from lookup table where refCode is faq_languange
    const languages = await prisma.lookup.findMany({
      where: {
        refCode: 'faq_languange',
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

    if (!languages || languages.length === 0) {
      // If no active languages found, try without status filter
      const allLanguages = await prisma.lookup.findMany({
        where: {
          refCode: 'faq_languange',
        },
        select: {
          lookupID: true,
          title: true,
          value: true
        }
      });
      
      // As a fallback, return some default options
      if (allLanguages.length === 0) {
        return [
          { value: 1, label: 'English' },
          { value: 2, label: 'Bahasa Melayu' }
        ];
      }
      
      // Use all languages if no active ones found
      const fallbackOptions = allLanguages.map(lang => ({
        value: lang.lookupID,
        label: lang.title
      }));
      
      return fallbackOptions;
    }

    // Transform to format suitable for dropdown
    const languageOptions = languages.map(lang => ({
      value: lang.lookupID,
      label: lang.title
    }));

    return languageOptions;
  } catch (error) {
    console.log('Error fetching language options:', error);
    return {
      statusCode: 500,
      message: "Server error",
    };
  }
}); 