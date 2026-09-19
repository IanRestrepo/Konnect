import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

/**
 * Defensa de la puerta del portal.
 *
 * El portal es público: cualquiera puede probar llaves contra una sesión. La
 * llave es larga y aleatoria, pero el freno de intentos por IP la respalda, y
 * vive en la base y no en memoria: en serverless cada instancia tiene su
 * propio proceso y un contador en RAM se reinicia solo, que es como no tener
 * ninguno.
 */

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
 * Recuerda en qué acceso se entró con el enlace, para que desde un marcador se
 * pueda volver sin él.
 *
 * Lleva la huella de la llave con la que se entró: al reiniciar el acceso la
 * llave cambia y la cookie deja de servir, igual que el enlace viejo.
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

export async function createDeviceToken(
  sessionId: string,
  accessId: string,
  llave: string,
): Promise<string> {
  return new SignJWT({ sessionId, accessId, llave })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accessId)
    .setIssuedAt()
    .setExpirationTime(`${DEVICE_DAYS}d`)
    .sign(deviceSecret());
}

export async function readDeviceToken(
  token: string | undefined,
): Promise<{ sessionId: string; accessId: string; llave: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deviceSecret());
    const sessionId = String(payload.sessionId ?? "");
    const accessId = String(payload.accessId ?? payload.sub ?? "");
    if (!sessionId || !accessId) return null;
    return { sessionId, accessId, llave: String(payload.llave ?? "") };
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
