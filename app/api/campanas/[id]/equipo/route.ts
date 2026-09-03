import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCampaignTeam } from "@/lib/store";
import { getCampaign } from "@/lib/data";
import { registrar } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Quién lleva la campaña. Null = sin responsable. */
  managerId: z.string().nullable().default(null),
  /** Encargados, además del responsable. */
  memberIds: z.array(z.string()).default([]),
});

/**
 * Nombra responsable y encargados de una campaña.
 *
 * Va por su propio permiso, `asignar_campanas`, y no por `editar_campanas`:
 * repartir quién puede entrar a qué es una decisión de mando, no una edición
 * más del expediente.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "asignar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite asignar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const antes = await getCampaign(id);
  if (!antes) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  const campaign = await setCampaignTeam(id, parsed.data);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  // Solo si cambió algo: guardar «asignó lo mismo que ya estaba» ensucia la
  // bitácora justo donde se busca un cambio de verdad.
  const cambio =
    antes.managerId !== campaign.managerId ||
    antes.memberIds.join() !== campaign.memberIds.join();

  if (cambio) {
    await registrar({
      actorId: session.userId,
      actorName: session.name,
      action: "campana.asignada",
      entity: "campaign",
      entityId: id,
      entityLabel: campaign.name,
      detail: `${campaign.memberIds.length} encargado${
        campaign.memberIds.length === 1 ? "" : "s"
      }${campaign.managerId ? "" : " · sin responsable"}`,
    });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  return NextResponse.json({ campaign });
}
