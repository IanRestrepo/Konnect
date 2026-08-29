import { z } from "zod";
import {
  ALL_PERMISSIONS,
  DEVELOPER,
  grantsEverything,
  isDeveloper,
} from "@/lib/permissions";

/**
 * La interfaz reenvía los permisos que le dio el servidor, comodines incluidos
 * ("*" para la administración, "**" para el desarrollador). Por eso aquí no se
 * rechaza nada: `normalizeRolePermissions` deja solo lo que el catálogo
 * reconoce, que además es lo que menos poder concede.
 */
export const rolePermissionsSchema = z.array(z.string());

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
