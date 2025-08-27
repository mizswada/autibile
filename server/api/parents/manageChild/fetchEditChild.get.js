// Added by: Firzana Huda 24 June 2025
import { PrismaClient } from '@prisma/client';

export default defineEventHandler(async (event) => {
    const { childID } = getQuery(event);
  
    if (!childID) {
      return { statusCode: 400, message: 'Missing child ID' };
    }
  
    try {
      const prisma = new PrismaClient();
      const child = await prisma.user_patients.findUnique({
        where: { patient_id: parseInt(childID) },
        select: {
          patient_id: true,
          fullname: true,
          nickname: true,
          gender: true,
          patient_ic: true,
          dob: true,
          autism_diagnose: true,
          diagnosed_on: true,
          available_session: true,
          status: true,
          OKUCard: true,
          treatment_type: true,
        }
      });
  
      return {
        statusCode: 200,
        data: child,
      };
    } catch (error) {
      console.error('Error fetching child detail:', error);
      return {
        statusCode: 500,
        message: 'Internal server error',
      };
    }
  });
  