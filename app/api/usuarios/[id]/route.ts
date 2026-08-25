import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { DEVELOPER_ROLE_ID, hasPermission, isDeveloper } from "@/lib/permissions";
import { deleteUser, listUsers, toPublicUser, updateUser } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").optional(),
});

/** Impide quedarse sin ninguna cuenta de administración activa. */
async function lastAdminStanding(userId: string) {
  const users = await listUsers();
  const admins = users.filter((u) => u.roleId === "rol_admin" && u.active);
  return admins.length === 1 && admins[0].id === userId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }

  const { id } = await params;

  // La cuenta reservada solo la toca su dueño.
  const objetivo = (await listUsers()).find((u) => u.id === id);
  if (objetivo?.roleId === DEVELOPER_ROLE_ID && !isDeveloper(session.permissions)) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const quitaAdmin =
    (parsed.data.active === false || (parsed.data.roleId && parsed.data.roleId !== "rol_admin")) &&
    (await lastAdminStanding(id));

  if (quitaAdmin) {
    return NextResponse.json(
      { error: "Es la única cuenta de administración activa. Crea otra antes de cambiarla." },
      { status: 409 },
    );
  }

  const { password, ...rest } = parsed.data;
  const patch = password ? { ...rest, passwordHash: await hashPassword(password) } : rest;

  const updated = await updateUser(id, patch);
  if (!updated) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  revalidatePath("/configuracion");
  return NextResponse.json({ user: toPublicUser(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 409 });
  }
  if (await lastAdminStanding(id)) {
    return NextResponse.json(
      { error: "Es la única cuenta de administración activa." },
      { status: 409 },
    );
  }

  const ok = await deleteUser(id);
  if (!ok) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  revalidatePath("/configuracion");
  return NextResponse.json({ ok: true });
}
