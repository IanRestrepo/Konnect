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
  isValidPin,
  readDeviceToken,
  registerFailure,
  verifyPin,
} from "@/lib/portal-guard";
import {
  clearPinFailures,
  getPortalAccess,
  registerPinFailure,
  verifyPortalCode,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Puerta del portal.
 *
 * Ya no se teclea ningún código: la agencia manda un enlace personal que lo
 * lleva dentro (`?acceso=…`). El enlace dice **quién** eres; el PIN de cuatro
 * dígitos demuestra que eres tú. Por eso tener el enlace nunca basta para
 * entrar: sin PIN elegido no se emite el acceso, y con PIN hay que acertarlo.
 *
 * Tres formas de llamar:
 *
 *  - `{ code }`: solo mira el enlace y dice qué toca —elegir PIN o
 *    escribirlo—. No abre nada.
 *  - `{ code, pin }`: entra con el enlace y el PIN. Sirve en cualquier
 *    dispositivo.
 *  - `{ pin }`: entra con el PIN en un dispositivo donde ya se entró antes,
 *    para quien abre el portal desde un marcador sin el enlace.
 *
 * El freno vive en la base, no en memoria: en serverless cada instancia tiene
 * su propio proceso y un contador en RAM no frena nada.
 */
const schema = z
  .object({
    code: z.string().optional(),
    pin: z.string().optional(),
  })
  .refine((v) => v.code || v.pin, { message: "Abre el enlace que te mandó la agencia." });

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
    return NextResponse.json({ error: "Abre el enlace que te mandó la agencia." }, { status: 400 });
  }

  const galleta = await cookies();
  const { code, pin } = parsed.data;

  /* ---------------- ¿Quién es? ---------------- */

  let accessId: string;

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

    // Solo mirar: qué pantalla toca. No se abre nada todavía.
    if (!pin) {
      await clearFailures(id, ip);
      return NextResponse.json(
        acceso.hasPin ? { pidePin: true, label: acceso.label } : { debeElegirPin: true, label: acceso.label },
      );
    }

    if (!acceso.hasPin) {
      return NextResponse.json(
        { error: "Primero elige tu PIN.", debeElegirPin: true },
        { status: 409 },
      );
    }
    accessId = acceso.id;
  } else {
    const device = await readDeviceToken(galleta.get(DEVICE_COOKIE)?.value);
    if (!device || device.sessionId !== id) {
      await registerFailure(id, ip);
      return NextResponse.json(
        { error: "Abre el enlace que te mandó la agencia.", sinEnlace: true },
        { status: 401 },
      );
    }
    accessId = device.accessId;
  }

  /* ---------------- ¿Es él? ---------------- */

  const limpio = (pin ?? "").trim();
  if (!isValidPin(limpio)) {
    await registerFailure(id, ip);
    return NextResponse.json({ error: "El PIN son 4 dígitos." }, { status: 401 });
  }

  const acceso = await getPortalAccess(accessId);
  if (!acceso || acceso.sessionId !== id || !acceso.hasPin) {
    return NextResponse.json(
      { error: "Abre el enlace que te mandó la agencia.", sinEnlace: true },
      { status: 401 },
    );
  }

  if (acceso.lockedUntil && acceso.lockedUntil > new Date()) {
    const minutos = Math.ceil((acceso.lockedUntil.getTime() - Date.now()) / 60_000);
    return NextResponse.json(
      { error: `Acceso bloqueado. Prueba en ${minutos} minuto${minutos === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  if (!(await verifyPin(limpio, acceso.pinHash))) {
    await registerFailure(id, ip);
    const restantes = await registerPinFailure(acceso.id);
    return NextResponse.json(
      {
        error:
          restantes > 0
            ? `PIN incorrecto. Te ${restantes === 1 ? "queda 1 intento" : `quedan ${restantes} intentos`}.`
            : "Demasiados intentos. Acceso bloqueado 15 minutos.",
      },
      { status: 401 },
    );
  }

  await clearFailures(id, ip);
  await clearPinFailures(acceso.id);

  const token = await createPortalToken({
    sessionId: id,
    accessId: acceso.id,
    role: acceso.role,
    label: acceso.label,
    canUpload: acceso.canUpload,
  });

  const response = NextResponse.json({ ok: true, role: acceso.role, label: acceso.label });
  response.cookies.set(PORTAL_COOKIE, token, PORTAL_COOKIE_OPTIONS);
  // Recuerda el dispositivo para que desde un marcador baste el PIN.
  response.cookies.set(DEVICE_COOKIE, await createDeviceToken(id, acceso.id), DEVICE_COOKIE_OPTIONS);
  return response;
}
