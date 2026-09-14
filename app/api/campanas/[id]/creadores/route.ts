import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import {
  endCreatorContract,
  hireCreator,
  removeCreatorFromCampaign,
  reopenCreatorContract,
} from "@/lib/store";
import { getCampaign, getCreator } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import { registrar } from "@/lib/audit";
import { IMPORTE_MAXIMO } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const contratar = z.object({
  creatorId: z.string({ error: "Selecciona un creador." }).min(1, "Selecciona un creador."),
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
  type: z.enum(["video", "short", "integracion", "directo", "post"]),
  /** Nombre propio del encargo. Vacío = la tarea estándar de esa red. */
  customType: z.string().max(60, "Ese nombre de pieza es demasiado largo.").default(""),
  /** Canal secundario pactado. Vacío = su canal principal. */
  channelId: z.string().default(""),
  clientPrice: z
    .number()
    .min(0)
    .max(IMPORTE_MAXIMO, "Ese cobro es demasiado grande.")
    .default(0),
  /** Lo que se lleva el creador. La diferencia es la comisión de la agencia. */
  creatorCost: z
    .number()
    .min(0)
    .max(IMPORTE_MAXIMO, "Ese pago es demasiado grande.")
    .default(0),
});

/** Contrata a un creador dentro de una campaña ya empezada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const parsed = contratar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const creator = await getCreator(parsed.data.creatorId);
  if (!creator) return NextResponse.json({ error: "Ese creador no existe." }, { status: 404 });

  // La comisión se guarda como cantidad fija: es exactamente la diferencia,
  // sin porcentajes que la redondeen por el camino.
  const comision = Math.max(parsed.data.clientPrice - parsed.data.creatorCost, 0);

  const hecho = await hireCreator(id, {
    creatorId: creator.id,
    creatorName: creator.name,
    platform: parsed.data.platform,
    type: parsed.data.type,
    customType: parsed.data.customType.trim(),
    channelId: parsed.data.channelId,
    clientPrice: parsed.data.clientPrice,
    commissionFixed: comision,
  });
  if (!hecho) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  revalidatePath("/sesiones");
  return NextResponse.json(hecho, { status: 201 });
}

const contrato = z.object({
  creatorId: z.string().min(1),
  accion: z.enum(["finalizar", "reabrir"]),
  reason: z.string().max(300, "La razón es demasiado larga.").default(""),
});

/**
 * Cierra o reabre el contrato con un creador.
 *
 * Cerrar no borra nada: lo entregado y lo pagado se queda con su dinero. Solo
 * se cancelan las piezas que seguían pendientes, que son las que ya no van a
 * pasar.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const parsed = contrato.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const creator = await getCreator(parsed.data.creatorId);

  if (parsed.data.accion === "reabrir") {
    const campaign = await reopenCreatorContract(id, parsed.data.creatorId);
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

    await registrar({
      actorId: session.userId,
      actorName: session.name,
      action: "contrato.reabierto",
      entity: "campaign",
      entityId: id,
      entityLabel: campaign.name,
      detail: creator?.name ?? "",
    });

    revalidatePath(`/campanas/${id}`);
    return NextResponse.json({ campaign });
  }

  const hecho = await endCreatorContract(id, parsed.data.creatorId, parsed.data.reason.trim());
  if (!hecho) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "contrato.finalizado",
    entity: "campaign",
    entityId: id,
    entityLabel: hecho.campaign.name,
    detail: [
      creator?.name,
      hecho.canceladas > 0
        ? `${hecho.canceladas} pieza${hecho.canceladas === 1 ? "" : "s"} pendiente${
            hecho.canceladas === 1 ? "" : "s"
          } cancelada${hecho.canceladas === 1 ? "" : "s"}`
        : null,
      parsed.data.reason.trim() || null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  return NextResponse.json(hecho);
}

/**
 * Quita a un creador de la campaña con todo lo suyo.
 *
 * Existe además de «finalizar contrato» porque son dos cosas distintas:
 * finalizar es para el trabajo que pasó de verdad y hay que poder mirar dentro
 * de un año; esto es para el creador que se metió por error o la campaña de
 * prueba, donde el rastro solo ensucia los totales.
 *
 * Antes había que borrarle las piezas una a una para poder sacarlo, que es
 * exactamente el rodeo que esto quita.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const campana = await getCampaign(id);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  if (!puedeEditarCampana(session, campana)) {
    return NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 });
  }

  const creatorId = new URL(request.url).searchParams.get("creatorId") ?? "";
  if (!creatorId) {
    return NextResponse.json({ error: "Falta el creador." }, { status: 400 });
  }

  const creator = await getCreator(creatorId);
  const hecho = await removeCreatorFromCampaign(id, creatorId);
  if (!hecho.ok) {
    return NextResponse.json({ error: "Ese creador no está en la campaña." }, { status: 404 });
  }

  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "campana.creador_quitado",
    entity: "campaign",
    entityId: id,
    entityLabel: campana.name,
    detail: [
      creator?.name ?? creatorId,
      hecho.piezas > 0
        ? `${hecho.piezas} pieza${hecho.piezas === 1 ? "" : "s"} borrada${
            hecho.piezas === 1 ? "" : "s"
          }`
        : null,
      hecho.pagadas > 0
        ? `${hecho.pagadas} ya estaba${hecho.pagadas === 1 ? "" : "n"} pagada${
            hecho.pagadas === 1 ? "" : "s"
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  revalidatePath("/sesiones");
  revalidatePath("/finanzas");
  return NextResponse.json(hecho);
}
