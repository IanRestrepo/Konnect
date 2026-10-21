import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { removePushSubscription, savePushSubscription } from "@/lib/store";

export const dynamic = "force-dynamic";

const alta = z.object({
  endpoint: z.string().url("Esa suscripción no es válida.").max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

/** Este navegador acepta recibir avisos de esta cuenta. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const parsed = alta.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  await savePushSubscription(session.userId, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

const baja = z.object({ endpoint: z.string().min(1).max(2000) });

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const parsed = baja.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  await removePushSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
