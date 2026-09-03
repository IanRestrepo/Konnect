import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCampaign,
  createCollabSession,
  newId,
  read,
  seedRequirementsFromCampaign,
} from "@/lib/store";
import { IMPORTE_MAXIMO } from "@/lib/pricing";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import type { Deliverable } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLATAFORMAS = [
  "youtube",
  "instagram",
  "tiktok",
  "x",
  "twitch",
  "kick",
  "discord",
  "roblox",
  "web",
] as const;

/**
 * Una línea de la campaña: un creador, en una red, con un tipo de pieza y su
 * precio. El presupuesto de campaña ya no reparte nada; aquí está el dinero.
 */
const linea = z.object({
  creatorId: z.string().min(1),
  platform: z.enum(PLATAFORMAS),
  type: z.enum(["video", "short", "integracion", "directo", "post"]),
  /** Canal secundario en el que se publica. Vacío = el principal. */
  channelId: z.string().default(""),
  /** Lo que paga el cliente por esta pieza. */
  clientPrice: z
    .number()
    .min(0)
    .max(IMPORTE_MAXIMO, "Ese importe es demasiado grande. El máximo es 9.999.999.999,99.")
    .default(0),
  /** Comisión propia de esta línea. Si falta, hereda el % de la campaña. */
  commissionPct: z.number().min(0).max(100).nullable().default(null),
  commissionFixed: z
    .number()
    .min(0)
    .max(IMPORTE_MAXIMO, "Esa comisión es demasiado grande.")
    .nullable()
    .default(null),
});

const schema = z.object({
  name: z
    .string({ error: "Falta el nombre de la campaña." })
    .min(1, "Falta el nombre de la campaña."),
  companyId: z.string({ error: "Selecciona un cliente." }).min(1, "Selecciona un cliente."),
  status: z.enum(["borrador", "activa", "pausada", "finalizada", "cancelada"]).default("borrador"),
  objective: z.enum(["awareness", "trafico", "conversiones", "lanzamiento"]).default("awareness"),
  currency: z.enum(["USD", "MXN", "COP", "EUR"]).default("USD"),
  /** Tope de referencia, opcional. Null = sin tope. */
  budget: z
    .number()
    .min(0)
    .max(IMPORTE_MAXIMO, "El tope es demasiado grande.")
    .nullable()
    .default(null),
  /** Margen por defecto de la agencia, en % sobre el pago al creador. */
  agencyFee: z.number().min(0).nullable().default(null),
  startDate: z.string().default(() => new Date().toISOString()),
  endDate: z.string().nullable().default(null),
  notes: z.string().default(""),
  lineas: z.array(linea).default([]),
  /** Quién lleva la campaña. */
  managerId: z.string().nullable().default(null),
  /** Empleados asignados, además del responsable. */
  memberIds: z.array(z.string()).default([]),
  /** Crear la sesión de entregas junto con la campaña. */
  crearSesion: z.boolean().default(true),
});

export async function POST(request: Request) {
  // Faltaba: cualquier cuenta con sesión podía crear campañas, porque el
  // middleware solo cubre las rutas de página y aquí no se comprobaba nada.
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite crear campañas." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { lineas, crearSesion, ...rest } = parsed.data;

  const deliverables: Deliverable[] = lineas.map((l) => {
    // El pago al creador se deriva aquí para que quede guardado y los informes
    // no dependan de rehacer la cuenta con un porcentaje que pudo cambiar.
    const comision =
      l.commissionFixed !== null
        ? Math.min(l.commissionFixed, l.clientPrice)
        : l.clientPrice * ((l.commissionPct ?? rest.agencyFee ?? 0) / 100);

    return {
    id: newId("dl"),
    creatorId: l.creatorId,
    type: l.type,
    status: "pendiente",
    platform: l.platform,
    channelId: l.channelId,
    clientPrice: l.clientPrice,
    commissionPct: l.commissionPct,
    commissionFixed: l.commissionFixed,
    paymentStatus: "pendiente",
    paidAt: null,
    receiptUrl: null,
    receiptName: null,
    receiptUploadedAt: null,
    videoUrl: null,
    videoId: null,
    title: null,
    thumbnail: null,
    publishedAt: null,
    durationSeconds: null,
    views: null,
    likes: null,
    comments: null,
    metricsUpdatedAt: null,
    agreedFee: l.clientPrice - comision,
    };
  });

  const campaign = await createCampaign({ ...rest, deliverables });

  /**
   * Cada creador de la campaña recibe su propia sesión con su código: es su
   * espacio de entregas, y no debe ver lo pactado con los demás.
   */
  if (crearSesion && lineas.length > 0) {
    const { creators } = await read();
    const unicos = [...new Set(lineas.map((l) => l.creatorId))];

    await Promise.all(
      unicos.map(async (creatorId) => {
        const creador = creators.find((c) => c.id === creatorId);
        const sesion = await createCollabSession({
          name: `${campaign.name} · ${creador?.name ?? "Creador"}`,
          campaignId: campaign.id,
          creatorId,
          accesses: [
            { role: "creador", label: creador?.name ?? "Creador", canUpload: true },
          ],
        });
        // El checklist nace de lo pactado: lo que se le encargó y lo que se le
        // pide entregar son lo mismo, y aprobarlo rellena el entregable solo.
        await seedRequirementsFromCampaign(sesion.id, campaign.id, creatorId);
      }),
    );
  }

  revalidatePath("/campanas");
  revalidatePath("/sesiones");
  revalidatePath("/");

  return NextResponse.json(campaign, { status: 201 });
}
