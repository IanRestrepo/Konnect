import { createToken, type SessionPayload } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { findUserByEmail, listRoles, updateUser } from "@/lib/store";
import type { User } from "@/lib/types";

/** Arma el contenido del token a partir del usuario y su rol. */
export async function sessionFor(user: User): Promise<SessionPayload> {
  const roles = await listRoles();
  const role = roles.find((r) => r.id === user.roleId);
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: role?.name ?? "Sin rol",
    permissions: role?.permissions ?? [],
  };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<{ token: string; session: SessionPayload } | { error: string }> {
  const user = await findUserByEmail(email);

  // Mismo mensaje para correo inexistente y contraseña mala: no revelamos cuál falló.
  const genericError = { error: "Correo o contraseña incorrectos." };
  if (!user) {
    // Coste similar al de un usuario real, para no delatar por tiempo de respuesta.
    await hashPassword(password);
    return genericError;
  }
  if (!user.active) return { error: "Esta cuenta está desactivada." };
  if (!(await verifyPassword(password, user.passwordHash))) return genericError;

  await updateUser(user.id, { lastLoginAt: new Date().toISOString() });

  const session = await sessionFor(user);
  return { token: await createToken(session), session };
}
