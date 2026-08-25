import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { PORTAL_COOKIE, readPortalToken } from "@/lib/portal";
import { addSessionItem } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["entregable", "guion", "borrador", "referencia", "nota"]).default("entregable"),
  title: z.string({ error: "Falta el título." }).min(1, "Falta el título."),
  url: z.string().nullable().default(null),
  notes: z.string().default(""),
});

/** Material subido desde el portal por el creador, el cliente o un invitado. */
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

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const item = await addSessionItem(id, {
    ...parsed.data,
    authorRole: portal.role,
    authorLabel: portal.label,
  });

  if (!item) {
    return NextResponse.json({ error: "La sesión está cerrada." }, { status: 409 });
  }

  revalidatePath(`/portal/${id}`);
  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ item }, { status: 201 });
}
