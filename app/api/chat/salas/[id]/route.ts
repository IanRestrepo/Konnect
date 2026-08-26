import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { deleteRoom, updateRoom } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  archived: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_chat")) {
    return NextResponse.json({ error: "Tu rol no permite editar salas." }, { status: 403 });
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

  const room = await updateRoom(id, parsed.data);
  if (!room) return NextResponse.json({ error: "Sala no encontrada." }, { status: 404 });

  revalidatePath("/chat");
  return NextResponse.json({ room });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_chat")) {
    return NextResponse.json({ error: "Tu rol no permite eliminar salas." }, { status: 403 });
  }

  const { id } = await params;
  // Borra también sus mensajes: la conversación no sobrevive a su sala.
  if (!(await deleteRoom(id))) {
    return NextResponse.json({ error: "Sala no encontrada." }, { status: 404 });
  }

  revalidatePath("/chat");
  return NextResponse.json({ ok: true });
}
