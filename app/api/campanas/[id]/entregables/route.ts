import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDeliverable } from "@/lib/store";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

const schema = z.object({
  creatorId: z.string({ error: "Selecciona un creador." }).min(1, "Selecciona un creador."),
  type: z.enum(["video", "short", "integracion", "directo", "post"]),
  status: z.enum(["pendiente", "en_revision", "publicado", "cancelado"]).default("publicado"),
  agreedFee: z.number().default(0),
  platform: z
    .enum(["youtube", "instagram", "tiktok", "x", "twitch", "kick", "discord", "roblox", "web"])
    .default("youtube"),
  /** Canal secundario en el que se publica. Vacío = el principal. */
  channelId: z.string().default(""),
  clientPrice: z.number().min(0).default(0),
  commissionPct: z.number().min(0).max(100).nullable().default(null),
  commissionFixed: z.number().min(0).nullable().default(null),
  paymentStatus: z.enum(["pendiente", "aprobado", "pagado"]).default("pendiente"),
  videoId: z.string().nullable().default(null),
  videoUrl: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  thumbnail: z.string().nullable().default(null),
  publishedAt: z.string().nullable().default(null),
  durationSeconds: z.number().nullable().default(null),
  views: z.number().nullable().default(null),
  likes: z.number().nullable().default(null),
  comments: z.number().nullable().default(null),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Faltaba comprobar nada: bastaba con tener sesión para añadirle piezas a
  // cualquier campaña. El middleware no cubre las rutas de API.
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 });
  }

  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const deliverable = await addDeliverable(id, {
    ...parsed.data,
    metricsUpdatedAt: parsed.data.views !== null ? new Date().toISOString() : null,
    paidAt: null,
    // El comprobante se sube después, cuando el pago se marca como hecho.
    receiptUrl: null,
    receiptName: null,
    receiptUploadedAt: null,
  });

  if (!deliverable) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  return NextResponse.json({ deliverable }, { status: 201 });
}
