import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { removeCreatorApiKey, setCreatorApiKey } from "@/lib/store";
import { PLATFORM_LABEL } from "@/lib/socials";

export const dynamic = "force-dynamic";

/** Plataformas cuya conexión ya funciona. El resto aparece "en desarrollo". */
const ACTIVAS = ["youtube"] as const;

const schema = z.object({
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  apiKey: z.string().trim().min(8, "La clave parece demasiado corta."),
  externalId: z.string().trim().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { platform, apiKey, externalId } = parsed.data;
  if (!ACTIVAS.includes(platform as (typeof ACTIVAS)[number])) {
    return NextResponse.json(
      { error: `La conexión con ${PLATFORM_LABEL[platform]} todavía está en desarrollo.` },
      { status: 400 },
    );
  }

  const creator = await setCreatorApiKey(id, platform, apiKey, externalId ?? "");
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ creator });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }

  const { id } = await params;
  const platform = schema.shape.platform.safeParse(
    new URL(request.url).searchParams.get("platform"),
  );
  if (!platform.success) {
    return NextResponse.json({ error: "Falta la plataforma." }, { status: 400 });
  }

  const creator = await removeCreatorApiKey(id, platform.data);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ creator });
}
