import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import {
  canSeeRoom,
  deleteMessage,
  editMessage,
  getRoom,
  listMessages,
  sendMessage,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string({ error: "Escribe algo." }).trim().min(1, "Escribe algo.").max(4000),
});

/**
 * La sala viaja como `?sala=<id>` en vez de como segmento de ruta: anidarla
 * bajo `[id]` hacía que el servidor de desarrollo perdiera la ruta.
 */

/** Comprueba sesión y acceso a la sala en un solo paso. */
async function permitido(id: string) {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "ver_chat")) return { error: 403 } as const;

  const room = await getRoom(id);
  if (!room) return { error: 404 } as const;
  if (!canSeeRoom(room, session.roleId, session.permissions)) return { error: 403 } as const;

  return { session, room } as const;
}

/**
 * Historial de la sala. Con `?desde=<fecha>` devuelve solo lo posterior, que es
 * lo que consulta el navegador mientras la pestaña está a la vista.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("sala") ?? "";
  const acceso = await permitido(id);
  if ("error" in acceso) {
    return NextResponse.json({ error: "Sin acceso a la sala." }, { status: acceso.error });
  }

  const desde = new URL(request.url).searchParams.get("desde") ?? undefined;
  const messages = await listMessages(id, { after: desde });

  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const id = new URL(request.url).searchParams.get("sala") ?? "";
  const acceso = await permitido(id);
  if ("error" in acceso) {
    return NextResponse.json({ error: "Sin acceso a la sala." }, { status: acceso.error });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const message = await sendMessage(id, {
    authorId: acceso.session.userId,
    authorName: acceso.session.name,
    body: parsed.data.body,
  });

  if (!message) {
    return NextResponse.json({ error: "La sala está archivada." }, { status: 409 });
  }

  return NextResponse.json({ message }, { status: 201 });
}

/** Cada quien edita lo suyo; quien gestiona el chat edita cualquier cosa. */
export async function PATCH(request: Request) {
  const id = new URL(request.url).searchParams.get("sala") ?? "";
  const acceso = await permitido(id);
  if ("error" in acceso) {
    return NextResponse.json({ error: "Sin acceso a la sala." }, { status: acceso.error });
  }

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({ messageId: z.string().min(1), body: z.string().trim().min(1).max(4000) })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe algo." }, { status: 400 });
  }

  const puedeTodo = hasPermission(acceso.session.permissions, "gestionar_chat");
  const message = await editMessage(id, parsed.data.messageId, parsed.data.body, {
    onlyAuthorId: puedeTodo ? undefined : acceso.session.userId,
  });

  if (!message) {
    return NextResponse.json({ error: "No puedes editar ese mensaje." }, { status: 403 });
  }

  return NextResponse.json({ message });
}

/** Cada quien borra lo suyo; quien gestiona el chat borra cualquier cosa. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("sala") ?? "";
  const acceso = await permitido(id);
  if ("error" in acceso) {
    return NextResponse.json({ error: "Sin acceso a la sala." }, { status: acceso.error });
  }

  const messageId = new URL(request.url).searchParams.get("mensaje") ?? "";
  if (!messageId) return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });

  const puedeTodo = hasPermission(acceso.session.permissions, "gestionar_chat");
  const borrado = await deleteMessage(id, messageId, {
    onlyAuthorId: puedeTodo ? undefined : acceso.session.userId,
  });

  if (!borrado) {
    return NextResponse.json({ error: "No puedes borrar ese mensaje." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
