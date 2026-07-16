import { getParentAuthContext } from "~/server/utils/appsParentAuth";

export default defineEventHandler(async (event) => {
  try {
    const auth = await getParentAuthContext(event);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, message: auth.message };
    }

    const banks = await prisma.lookup.findMany({
      where: {
        refCode: "bankName",
        status: "enable",
      },
      select: {
        lookupID: true,
        title: true,
        value: true,
      },
      orderBy: {
        lookupOrder: "asc",
      },
    });

    if (banks?.length) {
      return {
        statusCode: 200,
        message: "Bank list retrieved successfully",
        data: banks,
      };
    }

    const fallbackBanks = await prisma.lookup.findMany({
      where: { refCode: "bankName" },
      select: { lookupID: true, title: true, value: true },
      orderBy: { lookupOrder: "asc" },
    });

    return {
      statusCode: 200,
      message: "Bank list retrieved successfully",
      data: fallbackBanks,
    };
  } catch (error) {
    console.error("Error listing banks:", error);
    return { statusCode: 500, message: "Internal server error" };
  }
});
