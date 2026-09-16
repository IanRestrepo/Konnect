import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import { addCampaignPayment, removeCampaignPayment } from "@/lib/store";
import { MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE, esFallo, subirArchivo } from "@/lib/uploads";
import { IMPORTE_MAXIMO } from "@/lib/pricing";
import { registrar } from "@/lib/audit";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

const cobro = z.object({
  amount: z
    .number({ error: "Escribe el importe." })
    .positive("El importe tiene que ser mayor que cero.")
    .max(IMPORTE_MAXIMO, "Ese importe es demasiado grande."),
  paidAt: z.string().min(1, "Falta la fecha."),
  notes: z.string().max(500).default(""),
});

/**
 * Apunta un cobro al cliente. Llega como formulario porque puede traer el
 * comprobante de la transferencia; sin archivo también vale.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;
  const { session, campana } = auth;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const parsed = cobro.safeParse({
    amount: Number(form.get("amount")),
    paidAt: String(form.get("paidAt") ?? ""),
    notes: String(form.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  let receipt: { receiptUrl: string; receiptName: string } | null = null;
  const archivo = form.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    const subido = await subirArchivo(archivo, {
      carpeta: `cobros/${id}`,
      tipos: TIPOS_COMPROBANTE,
      maximo: MAXIMO_COMPROBANTE,
    });
    if (esFallo(subido)) {
      return NextResponse.json({ error: subido.error }, { status: subido.status });
    }
    receipt = { receiptUrl: subido.url, receiptName: subido.fileName };
  }

  await addCampaignPayment(id, {
    ...parsed.data,
    ...(receipt ?? {}),
    createdByName: session.name,
  });

  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "cobro.registrado",
    entity: "campaign",
    entityId: id,
    entityLabel: campana.name,
    detail: formatMoney(parsed.data.amount, campana.currency),
  });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/finanzas");
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Quita un cobro apuntado por error. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;
  const { session, campana } = auth;

  const paymentId = new URL(request.url).searchParams.get("paymentId") ?? "";
  const pago = campana.clientPayments.find((p) => p.id === paymentId);
  if (!pago || !(await removeCampaignPayment(id, paymentId))) {
    return NextResponse.json({ error: "Ese cobro no existe." }, { status: 404 });
  }

  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "cobro.quitado",
    entity: "campaign",
    entityId: id,
    entityLabel: campana.name,
    detail: formatMoney(pago.amount, campana.currency),
  });

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/finanzas");
  return NextResponse.json({ ok: true });
}
