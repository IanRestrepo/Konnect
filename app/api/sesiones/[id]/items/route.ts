import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { addSessionItem, removeSessionItem } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["entregable", "guion", "borrador", "referencia", "nota"]).default("entregable"),
  title: z.string({ error: "Falta el título." }).min(1, "Falta el título."),
  url: z.string().nullable().default(null),
  notes: z.string().default(""),
});

/** Material subido por la agencia. El creador y el cliente usan `/api/portal`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite subir material." }, { status: 403 });
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

  const item = await addSessionItem(id, {
    ...parsed.data,
    // La agencia no entra por código: queda firmada con el nombre del usuario.
    authorRole: null,
    authorLabel: session.name,
  });

  if (!item) {
    return NextResponse.json({ error: "La sesión no existe o está cerrada." }, { status: 409 });
  }

  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite borrar material." }, { status: 403 });
  }

  const { id } = await params;
  const itemId = new URL(request.url).searchParams.get("itemId") ?? "";
  if (!itemId) return NextResponse.json({ error: "Falta el elemento." }, { status: 400 });

  if (!(await removeSessionItem(id, itemId))) {
    return NextResponse.json({ error: "Elemento no encontrado." }, { status: 404 });
  }

  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ ok: true });
}
