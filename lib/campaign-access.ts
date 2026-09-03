import { grantsEverything, hasPermission } from "@/lib/permissions";
import type { Campaign } from "@/lib/types";

/**
 * Quién puede ver y tocar cada campaña.
 *
 * Hasta ahora los permisos eran globales: quien podía ver campañas, las veía
 * todas. Restringir eso de golpe le habría quitado el acceso a media agencia
 * el día del despliegue, así que la restricción se activa por rol y no por
 * defecto: sin `solo_campanas_asignadas` todo sigue exactamente igual.
 *
 * Con el permiso puesto, la cuenta solo alcanza las campañas que lleva o en
 * las que está asignada como encargada. La asignación en sí es informativa
 * para todos los demás: sirve para saber quién anda en qué.
 */

/** Lo mínimo que hace falta saber de la sesión para decidir. */
export type Actor = {
  userId: string;
  permissions: readonly string[];
};

/** Lo mínimo que hace falta saber de la campaña. */
export type CampanaAsignable = Pick<Campaign, "managerId" | "memberIds">;

/** Si a esta cuenta se le restringe a lo suyo. */
export function soloLoSuyo(actor: Actor): boolean {
  // El comodín pasa por encima: administración y desarrollador lo ven todo
  // aunque su rol tenga la restricción marcada por descuido.
  if (grantsEverything(actor.permissions)) return false;
  return hasPermission(actor.permissions, "solo_campanas_asignadas");
}

/** Si la cuenta está puesta en la campaña, como responsable o como encargada. */
export function estaAsignado(actor: Actor, campaign: CampanaAsignable): boolean {
  return campaign.managerId === actor.userId || campaign.memberIds.includes(actor.userId);
}

export function puedeVerCampana(actor: Actor, campaign: CampanaAsignable): boolean {
  if (!hasPermission(actor.permissions, "ver_campanas")) return false;
  if (!soloLoSuyo(actor)) return true;
  return estaAsignado(actor, campaign);
}

export function puedeEditarCampana(actor: Actor, campaign: CampanaAsignable): boolean {
  if (!hasPermission(actor.permissions, "editar_campanas")) return false;
  if (!soloLoSuyo(actor)) return true;
  return estaAsignado(actor, campaign);
}

/** Deja solo las campañas que esta cuenta puede ver. */
export function campanasVisibles<T extends CampanaAsignable>(actor: Actor, campanas: T[]): T[] {
  if (!soloLoSuyo(actor)) return campanas;
  return campanas.filter((c) => estaAsignado(actor, c));
}

/**
 * Deja solo las sesiones que esta cuenta puede ver.
 *
 * Una sesión hereda de su campaña: es el espacio de entrega de un trabajo
 * concreto, y quien no puede ver el trabajo tampoco sus entregas. Las sesiones
 * sueltas —sin campaña, o con la campaña ya borrada— quedan fuera del reparto,
 * así que solo las ve quien no tiene la restricción.
 */
export function sesionesVisibles<S extends { campaignId: string | null }>(
  actor: Actor,
  sesiones: S[],
  campanas: (CampanaAsignable & { id: string })[],
): S[] {
  if (!soloLoSuyo(actor)) return sesiones;

  const mias = new Set(
    campanas.filter((c) => estaAsignado(actor, c)).map((c) => c.id),
  );
  return sesiones.filter((s) => s.campaignId !== null && mias.has(s.campaignId));
}
