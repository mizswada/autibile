import { defineEventHandler, readBody } from 'h3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { productName, description, amount, quantity, status } = body;

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

    // Create product
    const product = await prisma.products.create({
      data: {
        product_name: productName,
        description: description,
        amount: parseFloat(amount),
        quantity: parseInt(quantity),
        status: status,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }
    });

    return {
      statusCode: 201,
      message: 'Product created successfully',
      data: product
    };
  } catch (error) {
    console.error('Error creating product:', error);
    return {
      statusCode: 500,
      message: 'Internal server error',
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
});
