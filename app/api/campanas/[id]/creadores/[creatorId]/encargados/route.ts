import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCampaignCreatorLeads } from "@/lib/store";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

/**
 * La lista llega entera y se reescribe. Los identificadores desconocidos se
 * caen en el store al escribirlos, no se rechaza la petición: si alguien borró
 * una cuenta mientras otro tenía la pantalla abierta, guardar el resto vale
 * más que devolver un error que obliga a recargar y volver a marcar todo.
 */
const schema = z.object({
  userIds: z.array(z.string()).max(20, "Demasiados encargados.").default([]),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; creatorId: string }> },
) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "asignar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite asignar encargados." }, { status: 403 });
  }

  const { id, creatorId } = await params;
  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const campaign = await setCampaignCreatorLeads(id, creatorId, parsed.data.userIds);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  revalidatePath(`/campanas/${id}`);
  revalidatePath(`/campanas/${id}/creador/${creatorId}`);
  return NextResponse.json({ campaign });
}
