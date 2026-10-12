import { requireAdmin } from "~/server/utils/reports/guard";
import { defineEventHandler } from 'h3';
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    // Billing data is for administrators only (not for doctors / therapists).
    const guard = requireAdmin(event);
    if (!guard.ok) {
      return { statusCode: guard.statusCode, message: guard.message };
    }

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
