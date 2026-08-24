import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee .env automáticamente: lo cargamos con la API de Node 22.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // el archivo puede no existir
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: { path: path.join("prisma", "migrations") },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
