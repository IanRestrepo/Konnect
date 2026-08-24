import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hash de contraseñas con scrypt y sal por usuario.
 *
 * Vive aparte de `lib/auth` a propósito: el middleware verifica el token en el
 * runtime edge, donde `node:crypto` no existe. Esto solo se importa desde
 * rutas de API, que sí corren en Node.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(password, salt, expected.length);

  // Comparación en tiempo constante: no filtra dónde falla.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
