import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import { addCampaignMaterial, removeCampaignMaterial } from "@/lib/store";
import { MAXIMO_MATERIAL, TIPOS_MATERIAL, esFallo, subirArchivo } from "@/lib/uploads";
import type { SessionItemKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS = ["entregable", "guion", "borrador", "referencia", "nota"] as const;

const enlace = z.object({
  kind: z.enum(KINDS).default("referencia"),
  title: z.string().trim().min(1, "Falta el título.").max(200, "Título demasiado largo."),
  url: z.string().nullable().default(null),
  notes: z.string().max(2000).default(""),
});

/** Permiso para editar sesiones y que la campaña sea de quien la toca. */
async function autorizar(id: string) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return { error: NextResponse.json({ error: "Tu rol no permite subir material." }, { status: 403 }) };
  }
  const campana = await getCampaign(id);
  if (!campana) {
    return { error: NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 }) };
  }
  if (!puedeEditarCampana(session, campana)) {
    return { error: NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 }) };
  }
  return { session, campana };
}

async function refrescar(id: string) {
  revalidatePath(`/campanas/${id}/sesion`);
  revalidatePath("/sesiones/[id]", "page");
  revalidatePath("/portal/[id]", "page");
}

/**
 * Comparte material con todas las sesiones de la campaña.
 *
 * Acepta las dos formas en la misma ruta, como en una sesión suelta: un
 * enlace pegado llega en JSON y un archivo llega como formulario.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;
  const { session } = auth;

  const esArchivo = (request.headers.get("content-type") ?? "").includes("multipart/form-data");

  if (esArchivo) {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    const kindCrudo = String(form.get("kind") ?? "referencia");
    const kind = (KINDS as readonly string[]).includes(kindCrudo)
      ? (kindCrudo as SessionItemKind)
      : "referencia";

    const subido = await subirArchivo(form.get("archivo"), {
      carpeta: `campanas/${id}`,
      tipos: TIPOS_MATERIAL,
      maximo: MAXIMO_MATERIAL,
    });
    if (esFallo(subido)) {
      return NextResponse.json({ error: subido.error }, { status: subido.status });
    }

    const material = await addCampaignMaterial(id, {
      kind,
      title: String(form.get("title") ?? "").trim() || subido.fileName,
      url: subido.url,
      notes: String(form.get("notes") ?? "").slice(0, 2000),
      fileName: subido.fileName,
      fileSize: subido.fileSize,
      contentType: subido.contentType,
      authorLabel: session.name,
    });
    if (!material) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

    await refrescar(id);
    return NextResponse.json({ material }, { status: 201 });
  }

  const parsed = enlace.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const material = await addCampaignMaterial(id, { ...parsed.data, authorLabel: session.name });
  if (!material) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  await refrescar(id);
  return NextResponse.json({ material }, { status: 201 });
}

/** Retira el material común de todas las sesiones. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const masterId = new URL(request.url).searchParams.get("masterId") ?? "";
  if (!masterId) return NextResponse.json({ error: "Falta el material." }, { status: 400 });

  if (!(await removeCampaignMaterial(id, masterId))) {
    return NextResponse.json({ error: "Ese material no existe." }, { status: 404 });
  }

  await refrescar(id);
  return NextResponse.json({ ok: true });
}
