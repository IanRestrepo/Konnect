import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCreatorContactFields } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  fields: z.array(
    z.object({
      label: z.string().min(1, "Cada campo necesita un nombre."),
      value: z.string().default(""),
    }),
  ),
});

/**
 * Reemplaza los contactos de nombre libre del creador: Discord, Telegram, el
 * correo de su mánager… Lo que no tiene un campo fijo en la ficha.
 *
 * Llega la lista entera y se reescribe: quitar una fila en la pantalla tiene
 * que borrarla de verdad.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_creadores")) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const limpio = parsed.data.fields
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label);

  const creator = await setCreatorContactFields(id, limpio);
  if (!creator) return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });

  revalidatePath(`/creadores/${id}`);
  return NextResponse.json({ creator });
}
