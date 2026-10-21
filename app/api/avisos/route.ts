import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listNotifications } from "@/lib/store";
import { pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Los avisos de quien llama, para la campana. Trae también la clave pública
 * de push: se lee aquí, en cada petición, y no al compilar, para que cambiar
 * las claves en el entorno no obligue a reconstruir.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const { unread, items } = await listNotifications(session.userId);
  return NextResponse.json({ unread, items, publicKey: pushPublicKey() });
}
