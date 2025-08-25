import { defineEventHandler, getQuery } from 'h3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const status = query.status;

    let whereClause = {
      deleted_at: null // Only show non-deleted products
    };
    
    if (status) {
      whereClause.status = status;
    }

    const products = await prisma.products.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc'
      }
    });

    return {
      statusCode: 200,
      message: 'Products retrieved successfully',
      data: products
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
});
