import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { removeDeliverable, updateDeliverable } from "@/lib/store";

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
  await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const campaign = await updateDeliverable(id, dlId, parsed.data);
  if (!campaign) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
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
  await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  if (!(await removeDeliverable(id, dlId))) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");

  return NextResponse.json({ ok: true });
}
