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

    // Check if product exists
    const existingProduct = await prisma.products.findFirst({
      where: {
        product_id: productId,
        deleted_at: null
      }
    });

    if (!existingProduct) {
      return {
        statusCode: 404,
        message: 'Product not found'
      };
    }

    // Soft delete product
    const deletedProduct = await prisma.products.update({
      where: {
        product_id: productId
      },
      data: {
        deleted_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: 'Product deleted successfully',
      data: deletedProduct
    };
  } catch (error) {
    console.error('Error deleting product:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
});
