import { PrismaClient } from "@prisma/client";

const createPrismaClient = () => new PrismaClient();

const globalForPrisma = globalThis as typeof globalThis & {
  __prisma?: ReturnType<typeof createPrismaClient>;
};

const prismaClient = globalForPrisma.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prismaClient;
}

export default prismaClient;
