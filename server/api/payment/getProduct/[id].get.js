import { defineEventHandler } from 'h3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const productId = parseInt(event.context.params.id);

    if (isNaN(productId)) {
      return {
        statusCode: 400,
        message: 'Invalid product ID'
      };
    }

    const product = await prisma.products.findFirst({
      where: {
        product_id: productId,
        deleted_at: null
      }
    });

    if (!product) {
      return {
        statusCode: 404,
        message: 'Product not found'
      };
    }

    return {
      statusCode: 200,
      message: 'Product retrieved successfully',
      data: product
    };
  } catch (error) {
    console.error('Error fetching product:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
});
