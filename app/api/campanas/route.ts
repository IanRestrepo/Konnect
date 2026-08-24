import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCampaign, newId } from "@/lib/store";
import type { Deliverable } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre de la campaña." }).min(1, "Falta el nombre de la campaña."),
  companyId: z.string({ error: "Selecciona un cliente." }).min(1, "Selecciona un cliente."),
  status: z.enum(["borrador", "activa", "pausada", "finalizada"]).default("borrador"),
  objective: z.enum(["awareness", "trafico", "conversiones", "lanzamiento"]).default("awareness"),
  currency: z.enum(["USD", "MXN", "COP", "EUR"]).default("USD"),
  budget: z.number().default(0),
  startDate: z.string().default(() => new Date().toISOString()),
  endDate: z.string().nullable().default(null),
  notes: z.string().default(""),
  /** Creadores elegidos: se crean como entregables pendientes. */
  creatorIds: z.array(z.string()).default([]),
  fees: z.record(z.string(), z.number()).default({}),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { creatorIds, fees, ...rest } = parsed.data;

  const deliverables: Deliverable[] = creatorIds.map((creatorId) => ({
    id: newId("dl"),
    creatorId,
    type: "video",
    status: "pendiente",
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
    agreedFee: fees[creatorId] ?? 0,
  }));

  const campaign = await createCampaign({ ...rest, deliverables });

  revalidatePath("/campanas");
  revalidatePath("/");
  return NextResponse.json({ campaign }, { status: 201 });
}
