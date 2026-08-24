import crypto from "node:crypto";

/**
 * Cifrado de datos bancarios en reposo (AES-256-GCM) y verificación del código
 * que el administrador debe escribir para revelarlos.
 *
 * ENCRYPTION_KEY: 32 bytes en base64.
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY no configurada");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY debe ser de 32 bytes en base64");
  return buf;
}

/** Devuelve `iv.tag.ciphertext`, todo en base64. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(
    ".",
  );
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) throw new Error("Payload cifrado inválido");
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString(
    "utf8",
  );
}

/** Comparación en tiempo constante para evitar filtrar el código por timing. */
export function verifyAccessCode(input: string): boolean {
  const expected = process.env.SENSITIVE_ACCESS_CODE ?? "123456";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Enmascara dejando visibles los últimos `visible` caracteres. */
export function mask(value: string, visible = 4): string {
  if (!value) return "";
  const tail = value.slice(-visible);
  return `${"•".repeat(Math.max(4, Math.min(12, value.length - visible)))} ${tail}`;
}

/* --------- Límite de intentos en memoria (se mueve a BD con Neon) --------- */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export function registerFailure(actor: string) {
  const now = Date.now();
  const current = attempts.get(actor);
  if (!current || current.until < now) {
    attempts.set(actor, { count: 1, until: now + WINDOW_MS });
    return MAX_ATTEMPTS - 1;
  }
  current.count += 1;
  return Math.max(0, MAX_ATTEMPTS - current.count);
}

export function isLocked(actor: string) {
  const current = attempts.get(actor);
  if (!current) return false;
  if (current.until < Date.now()) {
    attempts.delete(actor);
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

export function clearFailures(actor: string) {
  attempts.delete(actor);
}
