import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { canSeeRoom, createRoom, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string({ error: "Falta el nombre de la sala." }).min(1, "Falta el nombre de la sala."),
  description: z.string().default(""),
  color: z.string().default("#0046d9"),
  /** Vacío = la sala es del equipo entero. */
  roleIds: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "ver_chat")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }

  const rooms = (await listRooms()).filter((r) =>
    canSeeRoom(r, session.roleId, session.permissions),
  );
  return NextResponse.json({ rooms });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "gestionar_chat")) {
    return NextResponse.json({ error: "Tu rol no permite crear salas." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const room = await createRoom({ ...parsed.data, name: parsed.data.name.trim() });

  revalidatePath("/chat");
  return NextResponse.json({ room }, { status: 201 });
}
