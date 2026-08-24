import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateCampaign } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["borrador", "activa", "pausada", "finalizada"]).optional(),
  name: z.string().min(1).optional(),
  budget: z.number().optional(),
  notes: z.string().optional(),
  endDate: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_campanas")) {
    return NextResponse.json({ error: "Tu rol no permite editar campañas." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const campaign = await updateCampaign(id, parsed.data);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  revalidatePath("/campanas");
  revalidatePath(`/campanas/${id}`);
  revalidatePath("/");
  return NextResponse.json({ campaign });
}
