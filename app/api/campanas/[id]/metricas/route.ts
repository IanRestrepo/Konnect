import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { fetchVideo, hasApiKey } from "@/lib/youtube";
import { getCampaign } from "@/lib/data";
import { refreshDeliverableMetrics } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Vuelve a leer las métricas públicas de las piezas publicadas.
 *
 * Sin esto, las vistas se congelaban en el momento de añadir el entregable y
 * el CPM de la campaña envejecía sin que nadie se diera cuenta.
 *
 * Cada pieza guarda además una foto del momento (`MetricSnapshot`), que es lo
 * que alimenta la evolución en las gráficas.
 */
export async function POST(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("editar_campanas");
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Esa campaña no existe." }, { status: 404 });
  }

  if (!(await hasApiKey())) {
    return NextResponse.json(
      {
        error:
          "Falta la clave de YouTube. Ponla en Configuración → Integraciones o en YOUTUBE_API_KEY.",
      },
      { status: 501 },
    );
  }

  // Solo las que tienen video: una pieza pendiente no tiene nada que leer.
  const conVideo = campaign.deliverables.filter((d) => d.videoUrl && d.status !== "cancelado");

  if (conVideo.length === 0) {
    return NextResponse.json({ actualizados: 0, fallidos: 0, sinVideo: true });
  }

  let actualizados = 0;
  const fallidos: string[] = [];

  // En serie y no en paralelo: la cuota de la API es de 10.000 unidades al día
  // y una ráfaga de peticiones simultáneas se la come más rápido de lo que
  // ahorra en tiempo.
  for (const pieza of conVideo) {
    try {
      const video = await fetchVideo(pieza.videoUrl!);
      await refreshDeliverableMetrics(id, pieza.id, {
        views: video.views,
        likes: video.likes,
        comments: video.comments,
      });
      actualizados++;
    } catch {
      // Un video borrado o privado no debe abortar el resto.
      fallidos.push(pieza.title ?? pieza.id);
    }
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");

  return NextResponse.json({ actualizados, fallidos: fallidos.length, nombres: fallidos });
}
