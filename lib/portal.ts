import { SignJWT, jwtVerify } from "jose";
import type { PortalRole } from "@/lib/types";

/**
 * Acceso al portal externo de una sesión.
 *
 * Es deliberadamente independiente de `lib/auth`: quien entra con un código no
 * es un usuario de la agencia, no tiene rol ni permisos, y su token solo sirve
 * para la sesión que se le compartió. Cookie aparte, firma aparte y caducidad
 * corta, para que un enlace reenviado no se convierta en un acceso permanente.
 */

export const PORTAL_COOKIE = "konnect_portal";
const PORTAL_HOURS = 8;

export type PortalPayload = {
  sessionId: string;
  accessId: string;
  role: PortalRole;
  label: string;
  canUpload: boolean;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET falta o es demasiado corta (mínimo 32 caracteres).");
  }
  // Sufijo distinto: un token del portal nunca puede pasar por sesión de agencia.
  return new TextEncoder().encode(`${value}:portal`);
}

export async function createPortalToken(payload: PortalPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.accessId)
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_HOURS}h`)
    .sign(secret());
}

export async function readPortalToken(token: string | undefined): Promise<PortalPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = String(payload.role ?? "");
    if (role !== "creador" && role !== "cliente" && role !== "invitado") return null;

    return {
      sessionId: String(payload.sessionId ?? ""),
      accessId: String(payload.accessId ?? payload.sub ?? ""),
      role,
      label: String(payload.label ?? ""),
      canUpload: payload.canUpload === true,
    };
  } catch {
    return null;
  }
}

export const PORTAL_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: PORTAL_HOURS * 60 * 60,
};

/**
 * Código legible de 12 caracteres en tres bloques: `K7QP-2M4X-9RTB`.
 * Sin vocales ni caracteres que se confundan al dictarlo por teléfono.
 */
const ALFABETO = "23456789BCDFGHJKLMNPQRSTVWXYZ";

export function generateAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((bloque) => bloque.join(""))
    .join("-");
}

/** Acepta el código escrito con o sin guiones, en cualquier caja. */
export function normalizeAccessCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function codeHint(code: string): string {
  return code.slice(-4);
}
