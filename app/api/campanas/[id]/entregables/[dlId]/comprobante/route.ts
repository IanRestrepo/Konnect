import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { setDeliverableReceipt } from "@/lib/store";
import { MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE, esFallo, subirArchivo } from "@/lib/uploads";
import { registrar } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Adjunta el comprobante del pago al creador.
 *
 * Marcar «pagado» es una afirmación sin respaldo: cuando el creador pregunta,
 * o cuando cuadran las cuentas a fin de mes, hace falta el papel. Se guarda
 * junto a la pieza que se pagó y no en una carpeta suelta.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; dlId: string }> },
) {
  const session = await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const subido = await subirArchivo(form.get("archivo"), {
    carpeta: `comprobantes/${id}`,
    tipos: TIPOS_COMPROBANTE,
    maximo: MAXIMO_COMPROBANTE,
  });
  if (esFallo(subido)) {
    return NextResponse.json({ error: subido.error }, { status: subido.status });
  }

  const campaign = await setDeliverableReceipt(id, dlId, {
    receiptUrl: subido.url,
    receiptName: subido.fileName,
  });
  if (!campaign) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "pago.comprobante",
    entity: "deliverable",
    entityId: dlId,
    entityLabel: campaign.deliverables.find((d) => d.id === dlId)?.title ?? campaign.name,
    detail: subido.fileName,
  });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/finanzas");
  return NextResponse.json({ campaign });
}

/** Quita el comprobante, por si se subió el archivo equivocado. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; dlId: string }> },
) {
  const session = await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const campaign = await setDeliverableReceipt(id, dlId, {
    receiptUrl: null,
    receiptName: null,
  });
  if (!campaign) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "pago.comprobante.quitado",
    entity: "deliverable",
    entityId: dlId,
    entityLabel: campaign.deliverables.find((d) => d.id === dlId)?.title ?? campaign.name,
  });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/finanzas");
  return NextResponse.json({ campaign });
}
