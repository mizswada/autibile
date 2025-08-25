import { defineEventHandler, readBody } from 'h3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const productId = parseInt(event.context.params.id);
    const body = await readBody(event);
    const { productName, description, amount, quantity, status } = body;

    if (isNaN(productId)) {
      return {
        statusCode: 400,
        message: 'Invalid product ID'
      };
    }

    // Validation
    if (!productName || !description || !amount || !quantity || !status) {
      return {
        statusCode: 400,
        message: 'All fields are required'
      };
    }

    if (amount <= 0) {
      return {
        statusCode: 400,
        message: 'Amount must be greater than 0'
      };
    }

    if (quantity <= 0) {
      return {
        statusCode: 400,
        message: 'Quantity must be greater than 0'
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

    // Update product
    const updatedProduct = await prisma.products.update({
      where: {
        product_id: productId
      },
      data: {
        product_name: productName,
        description: description,
        amount: parseFloat(amount),
        quantity: parseInt(quantity),
        status: status,
        updated_at: new Date()
      }
    });

    return {
      statusCode: 200,
      message: 'Product updated successfully',
      data: updatedProduct
    };
  } catch (error) {
    console.error('Error updating product:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
});
