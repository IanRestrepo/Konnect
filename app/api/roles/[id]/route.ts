import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  DEVELOPER_ROLE_ID,
  hasPermission,
  isDeveloper,
  normalizeRolePermissions,
} from "@/lib/permissions";
import { grantError, rolePermissionsSchema } from "@/lib/role-schema";
import { deleteRole, updateRole } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "Falta el nombre del rol.").optional(),
  color: z.string().optional(),
  permissions: rolePermissionsSchema.optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }

  const { id } = await params;
  if (id === DEVELOPER_ROLE_ID && !isDeveloper(session.permissions)) {
    return NextResponse.json({ error: "Rol no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  // Los roles del sistema conservan sus permisos: lo que llegue se ignora, y
  // así editarles el nombre o el color nunca choca con su comodín.
  const permissions =
    parsed.data.permissions && normalizeRolePermissions(parsed.data.permissions);

  if (permissions) {
    const denegado = grantError(session.permissions, permissions);
    if (denegado) return NextResponse.json({ error: denegado }, { status: 403 });
  }

  const role = await updateRole(id, { ...parsed.data, permissions });
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
  if (id === DEVELOPER_ROLE_ID && !isDeveloper(session.permissions)) {
    return NextResponse.json({ error: "Rol no encontrado." }, { status: 404 });
  }

  const result = await deleteRole(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  revalidatePath("/configuracion");
  return NextResponse.json({ ok: true });
}
