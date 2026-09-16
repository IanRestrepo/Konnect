import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import { ensureCampaignNotesDoc } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Abre la nota de apuntes de la campaña, creándola si es la primera vez.
 *
 * Pide los dos permisos: es una nota —se edita con el de notas— sobre una
 * campaña que tiene que poder tocar quien la abre.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (
    !session ||
    !hasPermission(session.permissions, "editar_notas") ||
    !hasPermission(session.permissions, "editar_campanas")
  ) {
    return NextResponse.json({ error: "Tu rol no permite escribir apuntes." }, { status: 403 });
  }

  const { id } = await params;
  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const doc = await ensureCampaignNotesDoc(id, session.userId);
  if (!doc) return NextResponse.json({ error: "No se pudieron abrir los apuntes." }, { status: 500 });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/notas");
  return NextResponse.json(doc);
}
