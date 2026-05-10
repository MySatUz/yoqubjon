import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (typeof window === "undefined"
    ? new PrismaClient({})
    : (null as unknown as PrismaClient));

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
