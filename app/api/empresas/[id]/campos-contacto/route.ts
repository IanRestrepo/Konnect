import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCompanyContactFields } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  fields: z
    .array(
      z.object({
        label: z.string().min(1, "Cada campo necesita un nombre."),
        value: z.string().default(""),
      }),
    )
    .max(30, "Demasiados campos."),
});

/**
 * Reemplaza los contactos de nombre libre de un cliente: Discord, WeChat,
 * Telegram… Lo mismo que los creadores, que ya lo tenían.
 *
 * Llega la lista entera y se reescribe: quitar una fila en la pantalla tiene
 * que borrarla de verdad.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_empresas")) {
    return NextResponse.json({ error: "Tu rol no permite editar empresas." }, { status: 403 });
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

  if (!(await setCompanyContactFields(id, limpio))) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }

  revalidatePath(`/empresas/${id}`);
  return NextResponse.json({ ok: true });
}
