import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { PORTAL_COOKIE, readPortalToken } from "@/lib/portal";
import { hashPin, isValidPin, isWeakPin } from "@/lib/portal-guard";
import { setAccessPin } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({ pin: z.string(), repetir: z.string() });

/**
 * Elige el PIN de cuatro dígitos.
 *
 * Solo se puede llamar con una sesión de portal ya abierta, es decir, después
 * de haber acertado el código largo: el PIN no es una vía alternativa de
 * entrada, es un atajo para quien ya demostró tener el código.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const galleta = await cookies();
  const sesion = await readPortalToken(galleta.get(PORTAL_COOKIE)?.value);
  if (!sesion || sesion.sessionId !== id) {
    return NextResponse.json({ error: "Entra con tu código primero." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe el PIN dos veces." }, { status: 400 });
  }

  const { pin, repetir } = parsed.data;

  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "El PIN son exactamente 4 dígitos." }, { status: 400 });
  }
  if (pin !== repetir) {
    return NextResponse.json({ error: "Los dos PIN no coinciden." }, { status: 400 });
  }
  if (isWeakPin(pin)) {
    return NextResponse.json(
      { error: "Ese PIN es demasiado fácil de adivinar. Evita 1234 o cuatro dígitos iguales." },
      { status: 400 },
    );
  }

  await setAccessPin(sesion.accessId, await hashPin(pin));

  return NextResponse.json({ ok: true });
}
