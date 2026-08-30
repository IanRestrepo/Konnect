import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { duplicateCampaign } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1, "Ponle nombre a la copia."),
  startDate: z.string().optional(),
  conSesiones: z.boolean().default(true),
});

/** Copia una campaña para volver a correrla con el mismo equipo. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("editar_campanas");
  const { id } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const copia = await duplicateCampaign(id, parsed.data);
  if (!copia) {
    return NextResponse.json({ error: "Esa campaña no existe." }, { status: 404 });
  }

  revalidatePath("/campanas");
  revalidatePath("/sesiones");

  return NextResponse.json(copia, { status: 201 });
}
