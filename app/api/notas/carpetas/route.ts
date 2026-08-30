import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { createFolder, listFolders, removeFolder, updateFolder } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await requirePermission("ver_notas");
  return NextResponse.json(await listFolders());
}

const crear = z.object({
  name: z.string().min(1, "Ponle nombre a la carpeta."),
  parentId: z.string().nullable().default(null),
  icon: z.string().default("folder"),
  color: z.string().default("#4f7cff"),
});

export async function POST(request: Request) {
  await requirePermission("editar_notas");

  const parsed = crear.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  revalidatePath("/notas");
  return NextResponse.json(await createFolder(parsed.data), { status: 201 });
}

const editar = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().optional(),
});

export async function PATCH(request: Request) {
  await requirePermission("editar_notas");

  const parsed = editar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const { id, ...patch } = parsed.data;
  const folder = await updateFolder(id, patch);
  if (!folder) {
    return NextResponse.json({ error: "No se pudo mover esa carpeta." }, { status: 400 });
  }

  revalidatePath("/notas");
  return NextResponse.json(folder);
}

export async function DELETE(request: Request) {
  await requirePermission("editar_notas");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta la carpeta." }, { status: 400 });

  if (!(await removeFolder(id))) {
    return NextResponse.json({ error: "Esa carpeta no existe." }, { status: 404 });
  }

  revalidatePath("/notas");
  return NextResponse.json({ ok: true });
}
