import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma sobre Neon (driver adapter, requerido por Prisma 7).
 * Mientras DATABASE_URL esté vacío, `lib/data.ts` sigue leyendo los datos demo.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no configurada: la app está en modo demo.");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (process.env.DATABASE_URL ? createPrismaClient() : (undefined as never));

if (process.env.NODE_ENV !== "production" && process.env.DATABASE_URL) {
  globalForPrisma.prisma = prisma;
}

export function isDatabaseReady() {
  return Boolean(process.env.DATABASE_URL);
}
