import { SignJWT, jwtVerify } from "jose";

/**
 * Autenticación con JWT firmado (HS256) en cookie httpOnly.
 *
 * · Contraseñas: ver `lib/password` (scrypt, solo en runtime Node).
 * · Token: se verifica también en el middleware, así que usamos `jose`,
 *   que funciona tanto en Node como en el runtime edge.
 */

export const SESSION_COOKIE = "konnect_session";
const SESSION_HOURS = 12;

export type SessionPayload = {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET falta o es demasiado corta (mínimo 32 caracteres). Genera una con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  return new TextEncoder().encode(value);
}

/* ---------------- Token ---------------- */

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function readToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId ?? payload.sub ?? ""),
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      roleId: String(payload.roleId ?? ""),
      roleName: String(payload.roleName ?? ""),
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
    };
  } catch {
    return null;
  }
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_HOURS * 60 * 60,
};
