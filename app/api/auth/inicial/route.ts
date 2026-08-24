import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_OPTIONS, SESSION_COOKIE, createToken } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { sessionFor } from "@/lib/auth-service";
import { countUsers, createUser } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre." }).min(2, "Falta el nombre."),
  email: z.string({ error: "Falta el correo." }).email("El correo no es válido."),
  password: z
    .string({ error: "Falta la contraseña." })
    .min(8, "La contraseña necesita al menos 8 caracteres."),
});

/**
 * Crea la primera cuenta de administración. Solo funciona con la base vacía:
 * después de eso, las cuentas las crea el administrador desde Configuración.
 */
export async function POST(request: Request) {
  if ((await countUsers()) > 0) {
    return NextResponse.json(
      { error: "Ya hay cuentas creadas. Pide acceso a un administrador." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
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
    roleId: "rol_admin",
    active: true,
  });

  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 409 });
  }

  const session = await sessionFor(created);
  const response = NextResponse.json({ session }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, await createToken(session), COOKIE_OPTIONS);
  return response;
}
