// server/api/translation/translate.ts
export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { text, from, to } = body;
  
    if (!text || !from || !to) {
      return {
        statusCode: 400,
        message: 'Missing translation parameters.',
      };
    }
  
    try {
      const response = await $fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          q: text,
          source: from,
          target: to,
          format: 'text',
        },
      });
  
      return { translatedText: response.translatedText };
    } catch (error) {
      return {
        statusCode: 500,
        message: 'Translation failed.',
      };
    }
  });
  