import { prisma } from "@/lib/prisma";
import type { AuditEntry } from "@/lib/types";

/**
 * Bitácora de movimientos.
 *
 * Registra lo que mueve dinero o cambia el estado de algo, no cada clic: un
 * registro que lo guarda todo no lo lee nadie, y la pregunta que hay que poder
 * responder es «¿quién cerró esta campaña?», no «¿quién abrió esta pantalla?».
 *
 * Registrar nunca debe tumbar la operación que se estaba haciendo: si la
 * escritura falla, se avisa por consola y se sigue. Perder una línea de la
 * bitácora es malo; perder el pago que se estaba marcando, peor.
 */

/** Lo que pasó. Llaves estables: la pantalla las traduce. */
export const AUDIT_ACTIONS = {
  "campana.creada": "Creó la campaña",
  "campana.estado": "Cambió el estado de la campaña",
  "campana.borrada": "Borró la campaña",
  "campana.asignada": "Cambió quién lleva la campaña",
  "pago.estado": "Cambió el estado de pago",
  "pago.comprobante": "Adjuntó el comprobante de pago",
  "pago.comprobante.quitado": "Quitó el comprobante de pago",
  "entregable.aprobado": "Aprobó una entrega",
  "sesion.creada": "Creó la sesión",
  "sesion.material": "Subió material a la sesión",
  "banca.revelada": "Reveló datos bancarios",
  "banca.editada": "Cambió la información de pago",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditLabel(action: string): string {
  return AUDIT_ACTIONS[action as AuditAction] ?? action;
}

export type AuditInput = {
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  entity: "campaign" | "creator" | "session" | "deliverable";
  entityId: string;
  /** Cómo se llamaba en el momento del hecho. */
  entityLabel?: string;
  detail?: string;
};

export async function registrar(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorName: input.actorName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        entityLabel: input.entityLabel ?? "",
        detail: input.detail ?? "",
      },
    });
  } catch (e) {
    console.warn("[bitácora] no se pudo registrar el movimiento:", e);
  }
}

export type FiltroBitacora = {
  entity?: string;
  actorId?: string;
  /** Cuántas devolver. La pantalla pagina de 100 en 100. */
  limite?: number;
  /** Para paginar: solo lo anterior a esta fecha. */
  antesDe?: string;
};

export async function listarBitacora(filtro: FiltroBitacora = {}): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(filtro.entity ? { entity: filtro.entity } : {}),
      ...(filtro.actorId ? { actorId: filtro.actorId } : {}),
      ...(filtro.antesDe ? { createdAt: { lt: new Date(filtro.antesDe) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filtro.limite ?? 100, 300),
  });

  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    entityLabel: r.entityLabel,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  }));
}
