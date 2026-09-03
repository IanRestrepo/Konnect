import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { addSessionItem, logSessionEvent } from "@/lib/store";
import { MAXIMO_MATERIAL, TIPOS_MATERIAL, esFallo, subirArchivo } from "@/lib/uploads";
import type { SessionItemKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const CLASES: SessionItemKind[] = ["entregable", "guion", "borrador", "referencia", "nota"];

/** Sube material a la sesión desde la aplicación, no desde el portal. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite subir material." }, { status: 403 });
  }

  const { id } = await params;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const kindCrudo = String(form.get("kind") ?? "referencia");
  const kind = (CLASES as string[]).includes(kindCrudo)
    ? (kindCrudo as SessionItemKind)
    : "referencia";

  const subido = await subirArchivo(form.get("archivo"), {
    carpeta: `sesiones/${id}`,
    tipos: TIPOS_MATERIAL,
    maximo: MAXIMO_MATERIAL,
  });
  if (esFallo(subido)) {
    return NextResponse.json({ error: subido.error }, { status: subido.status });
  }

  const title = String(form.get("title") ?? "").trim() || subido.fileName;

  const item = await addSessionItem(id, {
    kind,
    title,
    url: subido.url,
    notes: String(form.get("notes") ?? "").slice(0, 2000),
    fileName: subido.fileName,
    fileSize: subido.fileSize,
    contentType: subido.contentType,
    // La agencia no tiene rol de portal: queda firmado con el nombre de quien
    // subió, que es lo que el creador y el cliente necesitan ver.
    authorRole: null,
    authorLabel: session.name,
  });

  if (!item) {
    return NextResponse.json({ error: "La sesión está cerrada." }, { status: 409 });
  }

  await logSessionEvent(id, {
    kind: "nota",
    message: `${session.name} subió «${title}»`,
    actorLabel: session.name,
    unreadAgency: false,
    unreadCreator: true,
  });

  revalidatePath(`/sesiones/${id}`);
  revalidatePath(`/portal/${id}`);
  return NextResponse.json({ item }, { status: 201 });
}
