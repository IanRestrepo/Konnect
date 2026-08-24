import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { newId, updateCompany } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  contacts: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, "Cada contacto necesita nombre."),
        role: z.string().default(""),
        email: z.string().default(""),
        phone: z.string().default(""),
        primary: z.boolean().default(false),
        notes: z.string().default(""),
      }),
    )
    .min(1, "Deja al menos un contacto."),
});

/** Reemplaza la lista completa de contactos de la empresa. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_empresas")) {
    return NextResponse.json({ error: "Tu rol no permite editar empresas." }, { status: 403 });
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

  // Siempre hay exactamente un principal: el marcado, o el primero.
  const marcado = parsed.data.contacts.findIndex((c) => c.primary);
  const principal = marcado === -1 ? 0 : marcado;

  const contacts = parsed.data.contacts.map((c, i) => ({
    id: c.id ?? newId("ct"),
    name: c.name.trim(),
    role: c.role.trim(),
    email: c.email.trim(),
    phone: c.phone.trim(),
    notes: c.notes.trim(),
    primary: i === principal,
  }));

  const company = await updateCompany(id, { contacts });
  if (!company) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  revalidatePath(`/empresas/${id}`);
  revalidatePath("/empresas");
  return NextResponse.json({ company });
}
