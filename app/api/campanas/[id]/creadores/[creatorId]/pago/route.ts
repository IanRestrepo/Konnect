import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCampaign, getCreator } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import { setCreatorPayment } from "@/lib/store";
import { MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE, esFallo, subirArchivo } from "@/lib/uploads";
import { creatorPayout } from "@/lib/pricing";
import { registrar } from "@/lib/audit";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Cómo se lee cada estado de pago en la bitácora. */
const PAGO_LABEL: Record<string, string> = {
  pendiente: "Marcado sin pagar",
  aprobado: "Aprobado para pago",
  pagado: "Marcado pagado",
};

async function autorizar(id: string) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return { error: NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 }) };
  }
  const campana = await getCampaign(id);
  if (!campana) {
    return { error: NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 }) };
  }
  if (!puedeEditarCampana(session, campana)) {
    return { error: NextResponse.json({ error: "Esa campaña no es tuya." }, { status: 403 }) };
  }
  return { session, campana };
}

function refrescar(id: string, creatorId: string) {
  revalidatePath(`/campanas/${id}`);
  revalidatePath(`/campanas/${id}/creador/${creatorId}`);
  revalidatePath("/finanzas");
  revalidatePath("/portal/[id]", "page");
}

/**
 * Adjunta un comprobante a varias piezas de un creador a la vez.
 *
 * Una transferencia paga todo lo que se le debía en la campaña: el mismo
 * archivo vale para todas esas piezas, en vez de subirlo una vez por pieza.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; creatorId: string }> },
) {
  const { id, creatorId } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;
  const { session, campana } = auth;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  let ids: string[] = [];
  try {
    ids = z.array(z.string()).parse(JSON.parse(String(form.get("deliverableIds") ?? "[]")));
  } catch {
    return NextResponse.json({ error: "Elige las piezas que paga." }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "Elige las piezas que paga." }, { status: 400 });
  }

  const subido = await subirArchivo(form.get("archivo"), {
    carpeta: `comprobantes/${id}`,
    tipos: TIPOS_COMPROBANTE,
    maximo: MAXIMO_COMPROBANTE,
  });
  if (esFallo(subido)) {
    return NextResponse.json({ error: subido.error }, { status: subido.status });
  }

  const cambiadas = await setCreatorPayment(id, creatorId, ids, {
    receipt: { receiptUrl: subido.url, receiptName: subido.fileName },
  });
  if (cambiadas === 0) {
    return NextResponse.json({ error: "Ninguna de esas piezas es de este creador." }, { status: 404 });
  }

  const creator = await getCreator(creatorId);
  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "pago.comprobante",
    entity: "campaign",
    entityId: id,
    entityLabel: campana.name,
    detail: `${creator?.name ?? creatorId} · ${cambiadas} pieza${cambiadas === 1 ? "" : "s"} · ${subido.fileName}`,
  });

  refrescar(id, creatorId);
  return NextResponse.json({ ok: true, cambiadas });
}

const cambio = z.object({
  deliverableIds: z.array(z.string()).min(1, "Elige las piezas."),
  paymentStatus: z.enum(["pendiente", "aprobado", "pagado"]),
});

/**
 * Aprueba, marca pagado o vuelve a sin pagar varias piezas de un creador.
 *
 * Sin comprobante no se aprueba ni se paga, igual que pieza a pieza: se
 * comprueba aquí contra cada pieza elegida, no solo en la pantalla.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; creatorId: string }> },
) {
  const { id, creatorId } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;
  const { session, campana } = auth;

  const parsed = cambio.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { deliverableIds, paymentStatus } = parsed.data;
  const piezas = campana.deliverables.filter(
    (d) => d.creatorId === creatorId && deliverableIds.includes(d.id) && d.status !== "cancelado",
  );
  if (piezas.length === 0) {
    return NextResponse.json({ error: "Ninguna de esas piezas es de este creador." }, { status: 404 });
  }

  if (paymentStatus !== "pendiente" && piezas.some((d) => !d.receiptUrl)) {
    return NextResponse.json(
      { error: "Adjunta el comprobante de pago antes de aprobarlo o marcarlo como pagado." },
      { status: 400 },
    );
  }

  await setCreatorPayment(id, creatorId, piezas.map((d) => d.id), { paymentStatus });

  const creator = await getCreator(creatorId);
  const importe = piezas.reduce((s, d) => s + creatorPayout(d, campana), 0);
  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "pago.estado",
    entity: "campaign",
    entityId: id,
    entityLabel: campana.name,
    detail: `${PAGO_LABEL[paymentStatus]} · ${creator?.name ?? creatorId} · ${formatMoney(importe, campana.currency)}`,
  });

  refrescar(id, creatorId);
  return NextResponse.json({ ok: true });
}
