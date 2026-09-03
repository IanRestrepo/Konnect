import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { getCollabSession, seedRequirementsFromCampaign } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Trae al checklist las piezas pactadas en la campaña.
 *
 * Las campañas nuevas lo hacen solas al crearse; esto es para las de antes,
 * que se quedaron con su sesión vacía y sin nada que atar. Se puede pulsar dos
 * veces sin miedo: solo entran las piezas que aún no tienen su petición.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("editar_sesiones");
  const { id } = await params;

  const sesion = await getCollabSession(id);
  if (!sesion) return NextResponse.json({ error: "Esa sesión no existe." }, { status: 404 });

  if (!sesion.campaignId || !sesion.creatorId) {
    return NextResponse.json(
      { error: "La sesión tiene que estar ligada a una campaña y a un creador." },
      { status: 409 },
    );
  }

  const creadas = await seedRequirementsFromCampaign(id, sesion.campaignId, sesion.creatorId);

  revalidatePath(`/sesiones/${id}`);
  revalidatePath(`/portal/${id}`);
  return NextResponse.json({ creadas });
}
