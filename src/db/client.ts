import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = prisma;
}

export async function checkDatabaseConnection(): Promise<{ isConnected: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { isConnected: true };
  } catch (err: any) {
    return { isConnected: false, error: err.message };
  }
}
