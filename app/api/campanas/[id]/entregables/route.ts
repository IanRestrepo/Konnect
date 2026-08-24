import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDeliverable } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  creatorId: z.string({ error: "Selecciona un creador." }).min(1, "Selecciona un creador."),
  type: z.enum(["video", "short", "integracion"]),
  status: z.enum(["pendiente", "en_revision", "publicado", "cancelado"]).default("publicado"),
  agreedFee: z.number().default(0),
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
  });

  if (!deliverable) {
    return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  }

  revalidatePath(`/campanas/${id}`);
  revalidatePath("/campanas");
  return NextResponse.json({ deliverable }, { status: 201 });
}
