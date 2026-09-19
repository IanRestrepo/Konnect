import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { setCreatorAgency } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Falta el nombre de la agencia.").max(120),
  exclusive: z.boolean().default(true),
  contactName: z.string().trim().max(120).default(""),
  email: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(60).default(""),
  website: z.string().trim().max(300).default(""),
  notes: z.string().trim().max(2000).default(""),
});

async function permitido() {
  const session = await getSession();
  return session && hasPermission(session.permissions, "editar_creadores");
}

/** Pone o cambia la agencia que representa al creador. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await permitido())) {
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

  if (!(await setCreatorAgency(id, parsed.data))) {
    return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });
  }
  revalidatePath(`/creadores/${id}`);
  revalidatePath("/creadores");
  return NextResponse.json({ ok: true });
}

/** Quita la agencia: el creador pasa a llevarse directamente. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await permitido())) {
    return NextResponse.json({ error: "Tu rol no permite editar creadores." }, { status: 403 });
  }
  const { id } = await params;

  if (!(await setCreatorAgency(id, null))) {
    return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });
  }
  revalidatePath(`/creadores/${id}`);
  revalidatePath("/creadores");
  return NextResponse.json({ ok: true });
}
