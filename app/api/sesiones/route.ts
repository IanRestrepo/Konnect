import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listSessions } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "ver_sesiones")) {
    return NextResponse.json({ error: "No tienes permiso." }, { status: 403 });
  }
  return NextResponse.json({ sessions: await listSessions() });
}

/**
 * Ya no se crean sesiones a mano.
 *
 * Una sesión es la de un creador dentro de una campaña, y nace sola al
 * contratarlo (`ensureCreatorSession`). Dejar esta puerta abierta era la vía
 * por la que aparecían sesiones sin campaña, que después nadie sabía de qué
 * eran.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Las sesiones se abren solas al contratar a un creador en una campaña." },
    { status: 405 },
  );
}
