import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { getDoc, removeDoc, updateDoc } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_notas");
  const { id } = await params;

  const doc = await getDoc(id);
  if (!doc) return NextResponse.json({ error: "Esa nota no existe." }, { status: 404 });
  return NextResponse.json(doc);
}

const editar = z.object({
  title: z.string().optional(),
  /** Documento de Tiptap. Se guarda tal cual. */
  content: z.unknown().optional(),
  /** El mismo texto aplanado, que es lo que se puede buscar. */
  plainText: z.string().optional(),
  icon: z.string().optional(),
  folderId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  links: z
    .array(
      z.object({
        campaignId: z.string().nullable().default(null),
        creatorId: z.string().nullable().default(null),
        companyId: z.string().nullable().default(null),
      }),
    )
    .optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("editar_notas");
  const { id } = await params;

  const parsed = editar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const doc = await updateDoc(id, { ...parsed.data, updatedById: session.userId });
  if (!doc) return NextResponse.json({ error: "Esa nota no existe." }, { status: 404 });

  revalidatePath("/notas");
  revalidatePath(`/notas/${id}`);
  return NextResponse.json(doc);
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("editar_notas");
  const { id } = await params;

  if (!(await removeDoc(id))) {
    return NextResponse.json({ error: "Esa nota no existe." }, { status: 404 });
  }

  revalidatePath("/notas");
  return NextResponse.json({ ok: true });
}
