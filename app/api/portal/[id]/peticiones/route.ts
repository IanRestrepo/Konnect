import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PORTAL_COOKIE, readPortalToken } from "@/lib/portal";
import { submitRequirement } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  requirementId: z.string().min(1),
  url: z.string().min(1, "Pega el enlace de lo que entregas."),
  notes: z.string().default(""),
});

/** El creador entrega una de las piezas que le pidió la agencia. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const galleta = await cookies();
  const sesion = await readPortalToken(galleta.get(PORTAL_COOKIE)?.value);
  if (!sesion || sesion.sessionId !== id) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
  if (!sesion.canUpload) {
    return NextResponse.json({ error: "Tu acceso es de solo lectura." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const actualizada = await submitRequirement(id, parsed.data.requirementId, {
    url: parsed.data.url,
    notes: parsed.data.notes,
    actorLabel: sesion.label,
  });

  if (!actualizada) {
    return NextResponse.json({ error: "Esa petición ya no existe." }, { status: 404 });
  }

  revalidatePath(`/portal/${id}`);
  revalidatePath(`/sesiones/${id}`);

  return NextResponse.json({ ok: true });
}
