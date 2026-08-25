import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { addSessionAccess, regenerateAccessCode, setAccessRevoked } from "@/lib/store";

export const dynamic = "force-dynamic";

const nuevo = z.object({
  role: z.enum(["creador", "cliente", "invitado"]),
  label: z.string().min(1, "Cada acceso necesita un nombre."),
  canUpload: z.boolean().default(true),
});

const cambio = z.object({
  accessId: z.string().min(1),
  action: z.enum(["revocar", "reactivar", "regenerar"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite editar sesiones." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = nuevo.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const actualizada = await addSessionAccess(id, parsed.data);
  if (!actualizada) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ session: actualizada }, { status: 201 });
}

/** Revoca, reactiva o cambia el código de un acceso concreto. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "editar_sesiones")) {
    return NextResponse.json({ error: "Tu rol no permite editar sesiones." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cambio.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const { accessId, action } = parsed.data;
  const actualizada =
    action === "regenerar"
      ? await regenerateAccessCode(accessId)
      : await setAccessRevoked(accessId, action === "revocar");

  if (!actualizada) return NextResponse.json({ error: "Acceso no encontrado." }, { status: 404 });

  revalidatePath(`/sesiones/${id}`);
  return NextResponse.json({ session: actualizada });
}
