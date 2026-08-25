import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readToken, type SessionPayload } from "@/lib/auth";
import {
  firstAllowedPath,
  hasPermission,
  isDeveloper,
  type PermissionId,
} from "@/lib/permissions";
import { getDisabledModules } from "@/lib/store";

/** Sesión del usuario en componentes de servidor y rutas de API. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readToken(store.get(SESSION_COOKIE)?.value);
}

/** Exige sesión; si no hay, manda al login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session;
}

/**
 * Exige un permiso concreto. Si el usuario no lo tiene, lo lleva a la primera
 * página que sí puede abrir en vez de dejarlo en un muro.
 */
export async function requirePermission(permission: PermissionId): Promise<SessionPayload> {
  const session = await requireSession();
  if (!hasPermission(session.permissions, permission)) {
    redirect(firstAllowedPath(session.permissions));
  }

  // Un módulo apagado por el desarrollador se cierra para todos, incluida la
  // administración. Él sigue entrando, porque si no no podría reactivarlo.
  if (!isDeveloper(session.permissions)) {
    const apagados = await getDisabledModules();
    if (apagados.includes(permission)) redirect("/");
  }

  return session;
}

export function can(session: SessionPayload | null, permission: PermissionId): boolean {
  return hasPermission(session?.permissions, permission);
}
