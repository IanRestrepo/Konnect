import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { DEVELOPER_ROLE_ID, hasPermission, isDeveloper } from "@/lib/permissions";
import { createUser, listRoles, listUsers, toPublicUser } from "@/lib/store";

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_usuarios")) {
    return NextResponse.json({ error: "No tienes permiso para gestionar usuarios." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const session = await getSession();
  const soyDev = isDeveloper(session?.permissions);

  const [users, roles] = await Promise.all([listUsers(), listRoles()]);

  // La cuenta y el rol reservados no existen para el resto del equipo.
  const visibles = soyDev ? users : users.filter((u) => u.roleId !== DEVELOPER_ROLE_ID);
  const rolesVisibles = soyDev ? roles : roles.filter((r) => r.id !== DEVELOPER_ROLE_ID);

  // El hash nunca sale del servidor.
  return NextResponse.json({ users: visibles.map(toPublicUser), roles: rolesVisibles });
}

const schema = z.object({
  name: z.string({ error: "Falta el nombre." }).min(2, "Falta el nombre."),
  email: z.string({ error: "Falta el correo." }).email("El correo no es válido."),
  password: z
    .string({ error: "Falta la contraseña." })
    .min(8, "La contraseña necesita al menos 8 caracteres."),
  roleId: z.string({ error: "Selecciona un rol." }).min(1, "Selecciona un rol."),
  active: z.boolean().default(true),
});

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const actor = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (parsed.success && parsed.data.roleId === DEVELOPER_ROLE_ID && !isDeveloper(actor?.permissions)) {
    return NextResponse.json({ error: "El rol indicado no existe." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const created = await createUser({
    name: parsed.data.name.trim(),
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    roleId: parsed.data.roleId,
    active: parsed.data.active,
  });

  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 409 });
  }

  revalidatePath("/configuracion");
  return NextResponse.json({ user: toPublicUser(created) }, { status: 201 });
}
