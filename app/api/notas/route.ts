import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { createDoc, listDocs, searchDocs } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Lista o busca notas. Con `q` busca; sin `q` filtra. */
export async function GET(request: Request) {
  await requirePermission("ver_notas");
  const params = new URL(request.url).searchParams;

  const q = params.get("q");
  if (q) return NextResponse.json(await searchDocs(q));

  const folderId = params.get("carpeta");
  return NextResponse.json(
    await listDocs({
      // "sueltas" = las que no están en ninguna carpeta.
      folderId: folderId === "sueltas" ? null : (folderId ?? undefined),
      archived: params.get("archivadas") === "1",
      campaignId: params.get("campana") ?? undefined,
      creatorId: params.get("creador") ?? undefined,
      companyId: params.get("empresa") ?? undefined,
    }),
  );
}

const crear = z.object({
  title: z.string().default(""),
  folderId: z.string().nullable().default(null),
  links: z
    .array(
      z.object({
        campaignId: z.string().nullable().default(null),
        creatorId: z.string().nullable().default(null),
        companyId: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  const session = await requirePermission("editar_notas");

  const parsed = crear.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const doc = await createDoc({ ...parsed.data, createdById: session.userId });

  revalidatePath("/notas");
  return NextResponse.json(doc, { status: 201 });
}
