import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma sobre Neon (driver adapter, requerido por Prisma 7).
 *
 * Se crea de forma perezosa: importar este módulo no debe fallar aunque falte
 * `DATABASE_URL` (durante el build, por ejemplo). El error salta al consultar.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no configurada. Añádela en .env.local (o en las variables de entorno del despliegue).",
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function client(): PrismaClient {
  // En desarrollo se reutiliza entre recargas para no abrir un pool por cada una.
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

/** Proxy perezoso: la conexión se abre en el primer acceso real, no al importar. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(client(), prop, receiver);
  },
});

export function isDatabaseReady() {
  return Boolean(process.env.DATABASE_URL);
}
