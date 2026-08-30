import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCreatorContacts } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().min(1, "Cada contacto necesita nombre."),
      role: z.string().default(""),
      email: z.string().default(""),
      phone: z.string().default(""),
      primary: z.boolean().default(false),
      notes: z.string().default(""),
    }),
  ),
});

/**
 * Reemplaza la lista completa de contactos del creador.
 *
 * A diferencia de una empresa, un creador puede no tener ninguno: se habla
 * con él directamente y basta con su correo de la ficha.
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

  const creator = await setCreatorContacts(id, parsed.data.contacts);
  if (!creator) {
    return NextResponse.json({ error: "Ese creador no existe." }, { status: 404 });
  }

  revalidatePath(`/creadores/${id}`);
  revalidatePath("/creadores");

  return NextResponse.json(creator);
}
