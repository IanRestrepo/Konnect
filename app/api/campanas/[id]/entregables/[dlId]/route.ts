import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { removeDeliverable, updateDeliverable } from "@/lib/store";
import { registrar } from "@/lib/audit";
import { formatMoney } from "@/lib/utils";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";

/** Cómo se lee cada estado de pago en la bitácora. */
const PAGO_LABEL: Record<string, string> = {
  pendiente: "Marcado sin pagar",
  aprobado: "Aprobado para pago",
  pagado: "Marcado pagado",
};

export const dynamic = "force-dynamic";

const schema = z
  .object({
    status: z.enum(["pendiente", "en_revision", "publicado", "cancelado"]).optional(),
    paymentStatus: z.enum(["pendiente", "aprobado", "pagado"]).optional(),
    clientPrice: z.number().min(0).optional(),
    commissionPct: z.number().min(0).max(100).nullable().optional(),
    commissionFixed: z.number().min(0).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada que cambiar." });

/**
 * Cambia el estado de una pieza: si está publicada y si está pagada.
 *
 * El estado de pago lo ve el creador en su portal, así que marcar «pagado»
 * aquí es lo que le confirma a él que el dinero salió.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; dlId: string }> },
) {
  const session = await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const antes = await getCampaign(id);
  if (!antes) return NextResponse.json({ error: "Esa campaña no existe." }, { status: 404 });
  if (!puedeEditarCampana(session, antes)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const campaign = await updateDeliverable(id, dlId, parsed.data);
  if (!campaign) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  // El estado de pago sí va a la bitácora: es dinero, y es lo que el creador
  // ve en su portal. Publicar o despublicar una pieza no.
  if (parsed.data.paymentStatus) {
    const pieza = campaign.deliverables.find((d) => d.id === dlId);
    await registrar({
      actorId: session.userId,
      actorName: session.name,
      action: "pago.estado",
      entity: "deliverable",
      entityId: dlId,
      entityLabel: pieza?.title ?? campaign.name,
      detail: `${PAGO_LABEL[parsed.data.paymentStatus]} · ${formatMoney(
        pieza?.agreedFee ?? 0,
        campaign.currency,
      )}`,
    });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  revalidatePath("/finanzas");

  return NextResponse.json(campaign);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; dlId: string }> },
) {
  const session = await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Esa campaña no existe." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  if (!(await removeDeliverable(id, dlId))) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");

  return NextResponse.json({ ok: true });
}
