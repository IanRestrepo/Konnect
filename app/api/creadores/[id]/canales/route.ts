import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { addCreatorChannel, removeCreatorChannel } from "@/lib/store";
import { fetchChannel } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string({ error: "Falta el enlace del canal." }).min(1, "Falta el enlace del canal."),
  label: z.string().default("Secundario"),
});

/** Añade un canal adicional resolviéndolo contra la API de YouTube. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
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

  let canal;
  try {
    canal = await fetchChannel(parsed.data.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos leer el canal.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const result = await addCreatorChannel(id, {
    label: parsed.data.label.trim() || "Secundario",
    channelId: canal.channelId,
    channelUrl: canal.channelUrl,
    handle: canal.handle,
    avatarUrl: canal.avatarUrl,
    subscribers: canal.subscribers,
    totalViews: canal.totalViews,
    videoCount: canal.videoCount,
    metricsUpdatedAt: new Date().toISOString(),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ creator: result.creator }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }

  const { id } = await params;
  const canalId = new URL(request.url).searchParams.get("canal");
  if (!canalId) return NextResponse.json({ error: "Falta el canal." }, { status: 400 });

  const ok = await removeCreatorChannel(id, canalId);
  if (!ok) return NextResponse.json({ error: "No se encontró el canal." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ ok: true });
}
