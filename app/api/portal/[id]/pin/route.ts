import { NextResponse } from "next/server";
import { z } from "zod";
import { PORTAL_COOKIE, PORTAL_COOKIE_OPTIONS, createPortalToken } from "@/lib/portal";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_OPTIONS,
  checkGuard,
  clearFailures,
  clientIp,
  createDeviceToken,
  hashPin,
  isValidPin,
  isWeakPin,
  registerFailure,
} from "@/lib/portal-guard";
import { claimAccessPin, verifyPortalCode } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string(), pin: z.string(), repetir: z.string() });

/**
 * Elige el PIN la primera vez que se abre el enlace, y con eso entra.
 *
 * Es el único momento en que el enlace solo basta, así que se protege en dos
 * puntos. Hasta que no hay PIN no se emite ningún acceso: abrir el enlace y
 * cerrar la pestaña no deja a nadie dentro. Y el PIN solo se puede poner una
 * vez —la escritura exige que siga vacío—: si dos personas abren el mismo
 * enlace a la vez, gana una y la otra tiene que escribirlo. Para cambiarlo, la
 * agencia reinicia el acceso.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = clientIp(request);

  const guard = await checkGuard(id, ip);
  if (guard.bloqueado) {
    const minutos = Math.ceil(guard.esperaSegundos / 60);
    return NextResponse.json(
      { error: `Demasiados intentos. Prueba de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe el PIN dos veces." }, { status: 400 });
  }

  const { code, pin, repetir } = parsed.data;

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

  const acceso = await verifyPortalCode(id, code);
  if (!acceso) {
    await registerFailure(id, ip);
    return NextResponse.json(
      { error: "Este enlace ya no sirve. Pídele a la agencia uno nuevo.", enlaceInvalido: true },
      { status: 401 },
    );
  }

  if (!(await claimAccessPin(acceso.id, await hashPin(pin)))) {
    return NextResponse.json(
      { error: "Este acceso ya tiene PIN. Escríbelo para entrar.", pidePin: true },
      { status: 409 },
    );
  }

  await clearFailures(id, ip);

  const token = await createPortalToken({
    sessionId: id,
    accessId: acceso.id,
    role: acceso.role,
    label: acceso.label,
    canUpload: acceso.canUpload,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PORTAL_COOKIE, token, PORTAL_COOKIE_OPTIONS);
  response.cookies.set(DEVICE_COOKIE, await createDeviceToken(id, acceso.id), DEVICE_COOKIE_OPTIONS);
  return response;
}
