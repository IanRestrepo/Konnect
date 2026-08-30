import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

/**
 * Defensa de la puerta del portal.
 *
 * El portal es público: cualquiera con el enlace llega al formulario. Un PIN de
 * cuatro dígitos son diez mil combinaciones, así que lo que lo protege de
 * verdad no es el PIN sino este freno, y por eso vive en la base y no en
 * memoria: en serverless cada instancia tiene su propio proceso y un contador
 * en RAM se reinicia solo, que es como no tener ninguno.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/* ---------------- PIN ---------------- */

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/**
 * PIN demasiado obvio. No es seguridad de verdad —el freno lo es— pero evita
 * que la mitad de los accesos acaben siendo 1234 o 0000.
 */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  const ascendente = "0123456789";
  const descendente = "9876543210";
  return ascendente.includes(pin) || descendente.includes(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, 64);
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(pin, Buffer.from(saltB64, "base64"), expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* ---------------- Freno por IP ---------------- */

const VENTANA_MINUTOS = 15;
const MAX_INTENTOS = 6;

/** La IP nunca se guarda en claro: solo un hash con el secreto de la app. */
function hashIp(ip: string): string {
  const sal = process.env.AUTH_SECRET ?? "konnect";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex");
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida"
  );
}

export type GuardState = {
  bloqueado: boolean;
  restantes: number;
  /** Segundos que faltan para poder reintentar. */
  esperaSegundos: number;
};

/** Intentos fallidos recientes de esta IP contra esta sesión. */
export async function checkGuard(sessionId: string, ip: string): Promise<GuardState> {
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000);
  const fallos = await prisma.portalAttempt.findMany({
    where: { sessionId, ipHash: hashIp(ip), createdAt: { gte: desde } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (fallos.length < MAX_INTENTOS) {
    return { bloqueado: false, restantes: MAX_INTENTOS - fallos.length, esperaSegundos: 0 };
  }

  // La espera corre desde el intento más antiguo de la ventana.
  const libreEn = fallos[0].createdAt.getTime() + VENTANA_MINUTOS * 60_000;
  return {
    bloqueado: true,
    restantes: 0,
    esperaSegundos: Math.max(0, Math.ceil((libreEn - Date.now()) / 1000)),
  };
}

export async function registerFailure(sessionId: string, ip: string): Promise<void> {
  await prisma.portalAttempt.create({ data: { sessionId, ipHash: hashIp(ip) } });
}

export async function clearFailures(sessionId: string, ip: string): Promise<void> {
  await prisma.portalAttempt.deleteMany({ where: { sessionId, ipHash: hashIp(ip) } });
}

/** Limpieza oportunista: los intentos viejos no le sirven a nadie. */
export async function purgeOldAttempts(): Promise<void> {
  const limite = new Date(Date.now() - 24 * 60 * 60_000);
  await prisma.portalAttempt.deleteMany({ where: { createdAt: { lt: limite } } });
}

/* ---------------- Cookie de dispositivo ---------------- */

/**
 * Recuerda *quién* entró, no que pueda entrar.
 *
 * Con varios accesos por sesión, un PIN de cuatro dígitos por sí solo es
 * ambiguo. Esta cookie identifica el acceso para poder pedir solo el PIN; no
 * autoriza nada por sí misma, y sin PIN correcto no abre la sesión.
 */
export const DEVICE_COOKIE = "konnect_portal_dev";
const DEVICE_DAYS = 90;

function deviceSecret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET falta o es demasiado corta (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(`${value}:portal-device`);
}

export async function createDeviceToken(sessionId: string, accessId: string): Promise<string> {
  return new SignJWT({ sessionId, accessId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accessId)
    .setIssuedAt()
    .setExpirationTime(`${DEVICE_DAYS}d`)
    .sign(deviceSecret());
}

export async function readDeviceToken(
  token: string | undefined,
): Promise<{ sessionId: string; accessId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deviceSecret());
    const sessionId = String(payload.sessionId ?? "");
    const accessId = String(payload.accessId ?? payload.sub ?? "");
    if (!sessionId || !accessId) return null;
    return { sessionId, accessId };
  } catch {
    return null;
  }
}

export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: DEVICE_DAYS * 24 * 60 * 60,
};
