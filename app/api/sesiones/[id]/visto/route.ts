import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { markSessionSeen } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Alguien del equipo abrió la sesión: sus avisos quedan leídos y se deja de
 * insistir a los demás. Lo llama la pantalla de la sesión al abrirse; no se
 * hace al pintar la página en el servidor porque una precarga del enlace
 * contaría como «visto» sin que nadie la hubiera mirado.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("ver_sesiones");
  const { id } = await params;
  await markSessionSeen(id, session.userId);
  return NextResponse.json({ ok: true });
}
