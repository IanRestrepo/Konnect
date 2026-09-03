import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { PORTAL_COOKIE, readPortalToken } from "@/lib/portal";
import { addSessionItem, logSessionEvent } from "@/lib/store";
import {
  MAXIMO_MATERIAL,
  TIPOS_MATERIAL,
  esFallo,
  subirArchivo,
} from "@/lib/uploads";
import type { SessionItemKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const CLASES: SessionItemKind[] = ["entregable", "guion", "borrador", "referencia", "nota"];

/**
 * Sube material desde el portal: lo hace el creador y también el cliente, que
 * es quien manda el brief, el logo o la guía de marca.
 *
 * Hasta ahora el portal solo aceptaba enlaces, y pedirle a un cliente que
 * suba su manual de marca «a algún sitio y me pasas el link» es exactamente
 * la fricción que la sesión venía a quitar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const store = await cookies();
  const portal = await readPortalToken(store.get(PORTAL_COOKIE)?.value);

  // El token va atado a una sesión: no sirve para entrar en otra.
  if (!portal || portal.sessionId !== id) {
    return NextResponse.json({ error: "Acceso no válido." }, { status: 401 });
  }
  if (!portal.canUpload) {
    return NextResponse.json({ error: "Tu acceso es solo de lectura." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const kindCrudo = String(form.get("kind") ?? "entregable");
  const kind = (CLASES as string[]).includes(kindCrudo)
    ? (kindCrudo as SessionItemKind)
    : "entregable";
  const notes = String(form.get("notes") ?? "").slice(0, 2000);

  const subido = await subirArchivo(form.get("archivo"), {
    carpeta: `sesiones/${id}`,
    tipos: TIPOS_MATERIAL,
    maximo: MAXIMO_MATERIAL,
  });
  if (esFallo(subido)) {
    return NextResponse.json({ error: subido.error }, { status: subido.status });
  }

  // El título por defecto es el nombre del archivo: pedirlo aparte sobra
  // cuando el archivo ya se llama como se llama.
  const title = String(form.get("title") ?? "").trim() || subido.fileName;

  const item = await addSessionItem(id, {
    kind,
    title,
    url: subido.url,
    notes,
    fileName: subido.fileName,
    fileSize: subido.fileSize,
    contentType: subido.contentType,
    authorRole: portal.role,
    authorLabel: portal.label,
  });

  if (!item) {
    return NextResponse.json({ error: "La sesión está cerrada." }, { status: 409 });
  }

  // La agencia tiene que enterarse de que llegó algo, o el material se queda
  // ahí sin que nadie lo mire.
  await logSessionEvent(id, {
    kind: "entrega",
    message: `${portal.label} subió «${title}»`,
    actorLabel: portal.label,
    unreadAgency: true,
    unreadCreator: false,
  });

  revalidatePath(`/portal/${id}`);
  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ item }, { status: 201 });
}
