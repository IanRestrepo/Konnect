import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getCampaign } from "@/lib/data";
import { puedeEditarCampana } from "@/lib/campaign-access";
import {
  addCampaignRequirement,
  removeCampaignRequirement,
  updateCampaignRequirement,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const KINDS = ["entregable", "guion", "borrador", "referencia", "nota"] as const;

const crear = z.object({
  kind: z.enum(KINDS).default("entregable"),
  title: z.string().trim().min(1, "Ponle un título a la petición.").max(200, "Título demasiado largo."),
  instructions: z.string().max(4000).default(""),
  steps: z.array(z.string().trim().min(1)).max(30, "Demasiados pasos.").default([]),
  required: z.boolean().default(true),
  dueDate: z.string().nullable().default(null),
});

const editar = z.object({
  masterId: z.string().min(1),
  title: z.string().trim().min(1, "Ponle un título a la petición.").max(200).optional(),
  instructions: z.string().max(4000).optional(),
  steps: z.array(z.string().trim().min(1)).max(30).optional(),
  required: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
});

/** Permiso para editar sesiones y que la campaña sea de quien la toca. */
async function autorizar(id: string) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return { error: NextResponse.json({ error: "Tu rol no permite editar sesiones." }, { status: 403 }) };
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

/** Todas las sesiones de la campaña y sus portales cambian a la vez. */
async function refrescar(id: string) {
  revalidatePath(`/campanas/${id}`);
  revalidatePath(`/campanas/${id}/sesion`);
  revalidatePath("/sesiones/[id]", "page");
  revalidatePath("/portal/[id]", "page");
}

/** Manda una petición a todas las sesiones de la campaña. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const parsed = crear.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const creada = await addCampaignRequirement(id, parsed.data);
  if (!creada) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  await refrescar(id);
  return NextResponse.json({ requirement: creada }, { status: 201 });
}

/** Cambia el enunciado de una petición común en todas las sesiones. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const parsed = editar.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { masterId, ...patch } = parsed.data;
  if (!(await updateCampaignRequirement(id, masterId, patch))) {
    return NextResponse.json({ error: "Esa petición no existe." }, { status: 404 });
  }

  await refrescar(id);
  return NextResponse.json({ ok: true });
}

/** Retira una petición común de todas las sesiones, con lo entregado en ella. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const masterId = new URL(request.url).searchParams.get("masterId") ?? "";
  if (!masterId) return NextResponse.json({ error: "Falta la petición." }, { status: 400 });

  if (!(await removeCampaignRequirement(id, masterId))) {
    return NextResponse.json({ error: "Esa petición no existe." }, { status: 404 });
  }

  await refrescar(id);
  return NextResponse.json({ ok: true });
}
