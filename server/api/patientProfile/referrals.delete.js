import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const id = query.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing referral id'
      });
    }

    await prisma.referrals.delete({
      where: { referrals_id: parseInt(id) }
    });

    return {
      statusCode: 200,
      message: 'Referral deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting referral:', error);
    return {
      statusCode: 500,
      message: 'Failed to delete referral',
      debug: error?.message || error
    };
  }
}); 