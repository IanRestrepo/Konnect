import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCreator } from "@/lib/data";
import { saveSocialReading } from "@/lib/store";
import { REDES_CON_LECTOR, leerRed, lectorConfigurado } from "@/lib/social-stats";
import { PLATFORM_LABEL } from "@/lib/socials";

export const dynamic = "force-dynamic";
// Cada lectura de Apify tarda de 10 a 40 segundos.
export const maxDuration = 60;

/**
 * Lee de TikTok e Instagram los seguidores de cada red del creador y los
 * guarda. Las redes van en paralelo y cada una responde por su cuenta: que
 * falle Instagram no tira lo que sí se leyó de TikTok.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }
  if (!lectorConfigurado()) {
    return NextResponse.json(
      { error: "La lectura de TikTok e Instagram no está configurada (falta APIFY_TOKEN)." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  const redes = creator.socials.filter((s) => REDES_CON_LECTOR.includes(s.platform));
  if (redes.length === 0) {
    return NextResponse.json(
      { error: "No tiene TikTok ni Instagram apuntados en «Redes sociales»." },
      { status: 400 },
    );
  }

  const resultados = await Promise.all(
    redes.map(async (red) => {
      const nombre = PLATFORM_LABEL[red.platform];
      try {
        const datos = await leerRed(red.platform, red.handle || red.url);
        await saveSocialReading(id, red.id, datos);
        return { red: nombre, ok: true as const, followers: datos.followers };
      } catch (e) {
        return { red: nombre, ok: false as const, error: e instanceof Error ? e.message : "Error" };
      }
    }),
  );

  revalidatePath(`/creadores/${id}`);
  revalidatePath("/creadores");
  return NextResponse.json({ resultados });
}
