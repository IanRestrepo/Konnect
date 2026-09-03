import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { deleteCampaign, updateCampaign } from "@/lib/store";
import { getCampaign } from "@/lib/data";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["borrador", "activa", "pausada", "finalizada", "cancelada"]).optional(),
  name: z.string().min(1).optional(),
  objective: z.enum(["awareness", "trafico", "conversiones", "lanzamiento"]).optional(),
  currency: z.enum(["USD", "MXN", "COP", "EUR"]).optional(),
  budget: z.number().optional(),
  notes: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const campaign = await updateCampaign(id, parsed.data);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  revalidatePath("/campanas");
  revalidatePath(`/campanas/${id}`);
  revalidatePath("/");
  return NextResponse.json({ campaign });
}

/**
 * Borra la campaña, sus entregables y sus sesiones de entrega.
 *
 * Se pide el nombre exacto en el cuerpo. No es por ceremonia: es lo único que
 * distingue un borrado querido de un clic en la fila equivocada, y aquí no hay
 * papelera de la que rescatarlo.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite borrar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  if ((body?.name ?? "").trim() !== campaign.name) {
    return NextResponse.json(
      { error: "Escribe el nombre exacto de la campaña para confirmar." },
      { status: 400 },
    );
  }

  const { ok, sesiones } = await deleteCampaign(id);
  if (!ok) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  console.info(
    `[auditoría] campaña borrada — campaña=${id} «${campaign.name}» sesiones=${sesiones} usuario=${session.userId} (${session.email})`,
  );

  revalidatePath("/campanas");
  revalidatePath("/sesiones");
  revalidatePath("/");
  return NextResponse.json({ ok: true, sesiones });
}
