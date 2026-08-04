import { handleAccountRequestSubmit } from "~/server/utils/accountRequestHandlers";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    return await handleAccountRequestSubmit(body);
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error while submitting your request.",
    };
  }
});
