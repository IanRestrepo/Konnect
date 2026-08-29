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
import { createRole, listRoles } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre del rol." }).min(2, "Falta el nombre del rol."),
  color: z.string().default("#6c6c78"),
  permissions: rolePermissionsSchema.default([]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  // El rol reservado no existe para nadie más: ni se ve ni se puede asignar.
  const roles = await listRoles();
  return NextResponse.json({
    roles: isDeveloper(session.permissions)
      ? roles
      : roles.filter((r) => r.id !== DEVELOPER_ROLE_ID),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const permissions = normalizeRolePermissions(parsed.data.permissions);
  const denegado = grantError(session.permissions, permissions);
  if (denegado) return NextResponse.json({ error: denegado }, { status: 403 });

  const role = await createRole({ ...parsed.data, permissions, system: false });
  revalidatePath("/configuracion");
  return NextResponse.json({ role }, { status: 201 });
}
