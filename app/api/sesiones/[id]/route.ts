import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { deleteCollabSession, updateCollabSession } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["abierta", "cerrada"]).optional(),
  notes: z.string().optional(),
  showMetrics: z.boolean().optional(),
  /** Cadena vacía = desvincular. Sirve para recolocar sesiones sueltas. */
  campaignId: z.string().nullable().optional(),
  creatorId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite editar sesiones." }, { status: 403 });
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

  const actualizada = await updateCollabSession(id, parsed.data);
  if (!actualizada) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

  revalidatePath("/sesiones");
  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ session: actualizada });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite eliminar sesiones." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await deleteCollabSession(id))) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  }

  revalidatePath("/sesiones");
  return NextResponse.json({ ok: true });
}
