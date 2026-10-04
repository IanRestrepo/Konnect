import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { newId, setCreatorSocials } from "@/lib/store";
import { getCreator } from "@/lib/data";
import { PLATFORM_URL } from "@/lib/socials";

export const dynamic = "force-dynamic";

const schema = z.object({
  socials: z.array(
    z.object({
      id: z.string().optional(),
      platform: z.enum([
        "youtube",
        "instagram",
        "tiktok",
        "x",
        "twitch",
        "kick",
        "discord",
        "roblox",
        "web",
      ]),
      handle: z.string().min(1, "Falta el usuario."),
      // Sin el campo, se conserva lo que hubiera: guardar las redes no puede
      // ser lo que borre los seguidores.
      followers: z.number().min(0).max(5_000_000_000).optional(),
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

  // La lista se reescribe entera. Lo que ya se sabía de cada red —vistas,
  // publicaciones, foto— se conserva: antes cada guardado lo dejaba todo a
  // cero, seguidores incluidos.
  const actual = await getCreator(id);
  if (!actual) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });
  const usuario = (h: string) => h.trim().replace(/^@/, "").toLowerCase();

  const socials = parsed.data.socials.map((s) => {
    const antes =
      actual.socials.find((x) => x.id === s.id) ??
      actual.socials.find((x) => x.platform === s.platform && usuario(x.handle) === usuario(s.handle));
    const followers = s.followers ?? antes?.followers ?? 0;
    return {
      id: s.id ?? antes?.id ?? newId("so"),
      platform: s.platform,
      handle: s.handle.trim(),
      url: PLATFORM_URL[s.platform](s.handle.trim()),
      avatarUrl: antes?.avatarUrl ?? null,
      followers,
      totalViews: antes?.totalViews ?? 0,
      contentCount: antes?.contentCount ?? 0,
      // La fecha es la del dato: cambia cuando alguien apunta otra cifra.
      metricsUpdatedAt:
        followers !== (antes?.followers ?? 0) ? new Date().toISOString() : (antes?.metricsUpdatedAt ?? null),
    };
  });

  const creator = await setCreatorSocials(id, socials);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ creator });
}
