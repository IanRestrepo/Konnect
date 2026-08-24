import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { newId, setCreatorSocials } from "@/lib/store";
import { PLATFORM_URL } from "@/lib/socials";

export const dynamic = "force-dynamic";

const schema = z.object({
  socials: z.array(
    z.object({
      id: z.string().optional(),
      platform: z.enum(["instagram", "tiktok", "x", "twitch", "kick", "discord", "roblox", "web"]),
      handle: z.string().min(1, "Falta el usuario."),
    }),
  ),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const socials = parsed.data.socials.map((s) => ({
    id: s.id ?? newId("so"),
    platform: s.platform,
    handle: s.handle.trim(),
    url: PLATFORM_URL[s.platform](s.handle.trim()),
  }));

  const creator = await setCreatorSocials(id, socials);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ creator });
}
