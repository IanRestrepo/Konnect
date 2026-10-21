import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { markNotificationsRead } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Sin lista, se marcan todos. */
  ids: z.array(z.string()).max(200).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  await markNotificationsRead(session.userId, parsed.data.ids);
  return NextResponse.json({ ok: true });
}
