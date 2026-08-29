import { z } from "zod";
import {
  ALL_PERMISSIONS,
  DEVELOPER,
  grantsEverything,
  isDeveloper,
  isRolePermission,
} from "@/lib/permissions";

/**
 * Permisos que acepta la API de roles: las llaves del catálogo y los dos
 * comodines. Los roles del sistema guardan "*" y "**", y la interfaz reenvía
 * lo que le llega, así que una lista cerrada al catálogo los rechazaba.
 */
export const rolePermissionsSchema = z.array(
  z.string().refine(isRolePermission, "Hay un permiso que no existe en el catálogo."),
);

/**
 * Nadie reparte más poder del que tiene: `gestionar_usuarios` deja crear roles,
 * no ascenderse a administración ni a desarrollador.
 */
export function grantError(
  actor: readonly string[] | undefined,
  permissions: readonly string[],
): string | null {
  if (permissions.includes(DEVELOPER) && !isDeveloper(actor)) {
    return "Solo el desarrollador puede conceder ese permiso.";
  }
  if (permissions.includes(ALL_PERMISSIONS) && !grantsEverything(actor)) {
    return "No puedes conceder todos los permisos si tú no los tienes.";
  }
  return null;
}
