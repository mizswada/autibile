import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const patientId = query.patientId;

    if (!patientId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Patient ID is required'
      });
    }

    // Fetch referrals from the database
    const patientReferrals = await prisma.referrals.findMany({
      where: { patient_id: parseInt(patientId) },
      orderBy: { referrals_date: 'desc' }
    });

    return {
      statusCode: 200,
      data: patientReferrals
    };

  } catch (error) {
    console.error('Error fetching referrals:', error);
    return {
      statusCode: 500,
      data: [],
      message: 'Failed to fetch referrals'
    };
  }
});