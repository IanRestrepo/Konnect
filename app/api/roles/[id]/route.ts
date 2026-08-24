import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { deleteRole, updateRole } from "@/lib/store";

export const dynamic = "force-dynamic";

const VALID = PERMISSIONS.map((p) => p.id) as [string, ...string[]];

const schema = z.object({
  name: z.string().min(2).optional(),
  color: z.string().optional(),
  permissions: z.array(z.enum(VALID)).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
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

  const role = await updateRole(id, parsed.data);
  if (!role) return NextResponse.json({ error: "Rol no encontrado." }, { status: 404 });

  revalidatePath("/configuracion");
  return NextResponse.json({ role });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteRole(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  revalidatePath("/configuracion");
  return NextResponse.json({ ok: true });
}
