import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { removeDeliverable, updateDeliverable } from "@/lib/store";
import { registrar } from "@/lib/audit";
import { formatMoney } from "@/lib/utils";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import { IMPORTE_MAXIMO } from "@/lib/pricing";
import { fetchVideo } from "@/lib/youtube";

/** Cómo se lee cada estado de pago en la bitácora. */
const PAGO_LABEL: Record<string, string> = {
  pendiente: "Marcado sin pagar",
  aprobado: "Aprobado para pago",
  pagado: "Marcado pagado",
};

export const dynamic = "force-dynamic";

const schema = z
  .object({
    status: z.enum(["pendiente", "en_revision", "publicado", "cancelado"]).optional(),
    paymentStatus: z.enum(["pendiente", "aprobado", "pagado"]).optional(),
    type: z.enum(["video", "short", "integracion", "directo", "post"]).optional(),
    /** Nombre propio del encargo. Cadena vacía = vuelve al nombre de fábrica. */
    customType: z.string().max(60, "Ese nombre de pieza es demasiado largo.").optional(),
    platform: z
      .enum(["youtube", "instagram", "tiktok", "x", "twitch", "kick", "discord", "roblox", "web"])
      .optional(),
    channelId: z.string().optional(),
    clientPrice: z
      .number()
      .min(0)
      .max(IMPORTE_MAXIMO, "Ese cobro es demasiado grande.")
      .optional(),
    commissionPct: z.number().min(0).max(100).nullable().optional(),
    commissionFixed: z
      .number()
      .min(0)
      .max(IMPORTE_MAXIMO, "Esa comisión es demasiado grande.")
      .nullable()
      .optional(),
    /**
     * Enlace de la publicación. Es el campo que faltaba: una pieza pactada
     * nacía sin video y no había ningún sitio donde pegárselo después, así que
     * la fila decía «Pendiente de publicar» aunque el video llevara semanas
     * arriba. Null lo vacía.
     */
    videoUrl: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    /**
     * Volver a leer YouTube con el enlace recibido para rellenar lo demás.
     *
     * Sin `default`: con uno, el objeto nunca estaría vacío y el `refine` de
     * abajo dejaría pasar una petición que no cambia nada.
     */
    leerVideo: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada que cambiar." });

/** Un enlace vacío o en blanco es «esta pieza no tiene video». */
function limpiarEnlace(url: string | null | undefined): string | null | undefined {
  if (url === undefined) return undefined;
  return url?.trim() ? url.trim() : null;
}

/**
 * Cambia una pieza: qué es, dónde sale, con qué enlace y cuánto dinero mueve.
 *
 * El estado de pago lo ve el creador en su portal, así que marcar «pagado»
 * aquí es lo que le confirma a él que el dinero salió.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; dlId: string }> },
) {
  const session = await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const antes = await getCampaign(id);
  if (!antes) return NextResponse.json({ error: "Esa campaña no existe." }, { status: 404 });
  if (!puedeEditarCampana(session, antes)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const { leerVideo, videoUrl, ...resto } = parsed.data;
  const enlace = limpiarEnlace(videoUrl);

  // Con el enlace puesto se intenta traer título, miniatura y vistas de
  // YouTube. Si falla —sin clave, enlace de otra red, video privado— se guarda
  // el enlace pelado: perder el cambio entero por no poder adornarlo sería
  // peor que quedarse sin miniatura.
  /** Lo que se lee del video, o lo que se limpia al quitarle el enlace. */
  type DatosPublicacion = Parameters<typeof updateDeliverable>[2];
  let deYoutube: DatosPublicacion = {};

  // Quitar el enlace tiene que llevarse también lo que venía con él: si no, la
  // fila sigue enseñando el título y la miniatura de un video que ya no está.
  if (enlace === null) {
    deYoutube = {
      videoId: null,
      title: null,
      thumbnail: null,
      durationSeconds: null,
      views: null,
      likes: null,
      comments: null,
    };
  }

  if (leerVideo && enlace) {
    try {
      const video = await fetchVideo(enlace);
      deYoutube = {
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        publishedAt: video.publishedAt,
        durationSeconds: video.durationSeconds,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
      };
    } catch {
      // Nos quedamos con el enlace tal cual.
    }
  }

  const campaign = await updateDeliverable(id, dlId, {
    ...resto,
    ...(enlace === undefined ? {} : { videoUrl: enlace }),
    ...deYoutube,
  });
  if (!campaign) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  // El estado de pago sí va a la bitácora: es dinero, y es lo que el creador
  // ve en su portal. Publicar o despublicar una pieza no.
  if (parsed.data.paymentStatus) {
    const pieza = campaign.deliverables.find((d) => d.id === dlId);
    await registrar({
      actorId: session.userId,
      actorName: session.name,
      action: "pago.estado",
      entity: "deliverable",
      entityId: dlId,
      entityLabel: pieza?.title ?? campaign.name,
      detail: `${PAGO_LABEL[parsed.data.paymentStatus]} · ${formatMoney(
        pieza?.agreedFee ?? 0,
        campaign.currency,
      )}`,
    });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  revalidatePath("/finanzas");

  return NextResponse.json(campaign);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; dlId: string }> },
) {
  const session = await requirePermission("editar_campanas");
  const { id, dlId } = await params;

  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Esa campaña no existe." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  if (!(await removeDeliverable(id, dlId))) {
    return NextResponse.json({ error: "Ese entregable no existe." }, { status: 404 });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");

  return NextResponse.json({ ok: true });
}
