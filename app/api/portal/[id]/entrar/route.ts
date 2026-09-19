import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { PORTAL_COOKIE, PORTAL_COOKIE_OPTIONS, createPortalToken } from "@/lib/portal";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_OPTIONS,
  checkGuard,
  clearFailures,
  clientIp,
  createDeviceToken,
  readDeviceToken,
  registerFailure,
} from "@/lib/portal-guard";
import { getPortalAccess, markAccessSeen, verifyPortalCode } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Puerta del portal.
 *
 * Se entra solo con el enlace personal que manda la agencia (`?acceso=…`). El
 * PIN de cuatro dígitos se quitó: al creador le sobraba un paso, y la llave
 * del enlace ya es larga y aleatoria —adivinarla no es viable, y el freno de
 * intentos sigue en pie—. Lo que protege ahora es no reenviar el enlace; si
 * se reenvía, «Reiniciar» en la sesión lo deja sin valor y genera otro.
 *
 * Dos formas de llamar:
 *
 *  - `{ code }`: entra con la llave del enlace.
 *  - `{}`: entra en un dispositivo donde ya se entró con el enlace, para quien
 *    abre el portal desde un marcador.
 *
 * El freno vive en la base, no en memoria: en serverless cada instancia tiene
 * su propio proceso y un contador en RAM no frena nada.
 */
const schema = z.object({ code: z.string().optional() });

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

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Abre el enlace que te mandó la agencia." }, { status: 400 });
  }

  const galleta = await cookies();
  const { code } = parsed.data;

  let accessId: string | null = null;
  let huella: string | null = null;

  if (code) {
    const acceso = await verifyPortalCode(id, code);
    if (!acceso) {
      await registerFailure(id, ip);
      // Mismo mensaje para enlace malo, acceso reiniciado y sesión cerrada.
      return NextResponse.json(
        { error: "Este enlace ya no sirve. Pídele a la agencia uno nuevo.", enlaceInvalido: true },
        { status: 401 },
      );
    }
    accessId = acceso.id;
  } else {
    const device = await readDeviceToken(galleta.get(DEVICE_COOKIE)?.value);
    if (device?.sessionId === id) {
      accessId = device.accessId;
      huella = device.llave;
    }
  }

  // El dispositivo recordado también caduca si el acceso se revocó o se
  // reinició: getPortalAccess no devuelve accesos revocados.
  const acceso = accessId ? await getPortalAccess(accessId) : null;
  if (!acceso || acceso.sessionId !== id || (huella !== null && huella !== acceso.llave)) {
    return NextResponse.json(
      { error: "Abre el enlace que te mandó la agencia.", sinEnlace: true },
      { status: 401 },
    );
  }

  await clearFailures(id, ip);
  // Con el enlace ya se anotó al verificarlo; desde el marcador, aquí.
  if (!code) await markAccessSeen(acceso.id);

  const token = await createPortalToken({
    sessionId: id,
    accessId: acceso.id,
    role: acceso.role,
    label: acceso.label,
    canUpload: acceso.canUpload,
  });

  const response = NextResponse.json({ ok: true, role: acceso.role, label: acceso.label });
  response.cookies.set(PORTAL_COOKIE, token, PORTAL_COOKIE_OPTIONS);
  // Recuerda el dispositivo para que desde un marcador se entre sin el enlace.
  response.cookies.set(DEVICE_COOKIE, await createDeviceToken(id, acceso.id, acceso.llave), DEVICE_COOKIE_OPTIONS);
  return response;
}
