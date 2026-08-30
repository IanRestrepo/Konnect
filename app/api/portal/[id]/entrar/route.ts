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
 * Puerta del portal. Acepta dos formas de entrar:
 *
 *  - `code`: el código largo que entrega la agencia. Es el primer contacto y
 *    la vía de recuperación si se olvida el PIN.
 *  - `pin`: cuatro dígitos que el creador eligió, solo válidos en el
 *    dispositivo donde ya entró una vez.
 *
 * El freno vive en la base, no en memoria: en serverless cada instancia tiene
 * su propio proceso y un contador en RAM no frena nada.
 */
const schema = z
  .object({
    code: z.string().optional(),
    pin: z.string().optional(),
  })
  .refine((v) => v.code || v.pin, { message: "Escribe el código." });

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
    return NextResponse.json({ error: "Escribe el código." }, { status: 400 });
  }

  const galleta = await cookies();

  /* ---------------- Entrada con PIN ---------------- */

  if (parsed.data.pin) {
    const pin = parsed.data.pin.trim();
    const device = await readDeviceToken(galleta.get(DEVICE_COOKIE)?.value);

    if (!device || device.sessionId !== id || !isValidPin(pin)) {
      await registerFailure(id, ip);
      return NextResponse.json({ error: "PIN no válido.", needsCode: !device }, { status: 401 });
    }

    const acceso = await getPortalAccess(device.accessId);
    if (!acceso || !acceso.hasPin) {
      return NextResponse.json({ error: "Entra con tu código de acceso.", needsCode: true }, { status: 401 });
    }

    if (acceso.lockedUntil && acceso.lockedUntil > new Date()) {
      const minutos = Math.ceil((acceso.lockedUntil.getTime() - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Acceso bloqueado. Prueba en ${minutos} minuto${minutos === 1 ? "" : "s"}.` },
        { status: 429 },
      );
    }

    if (!(await verifyPin(pin, acceso.pinHash))) {
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
    return response;
  }

  /* ---------------- Entrada con código largo ---------------- */

  const acceso = await verifyPortalCode(id, parsed.data.code ?? "");
  if (!acceso) {
    await registerFailure(id, ip);
    const restante = await checkGuard(id, ip);
    // Mismo mensaje para código malo, acceso revocado y sesión cerrada.
    return NextResponse.json(
      {
        error:
          restante.restantes > 0
            ? `Código no válido. Te ${restante.restantes === 1 ? "queda 1 intento" : `quedan ${restante.restantes} intentos`}.`
            : "Código no válido. Espera unos minutos antes de reintentar.",
      },
      { status: 401 },
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

  const response = NextResponse.json({
    ok: true,
    role: acceso.role,
    label: acceso.label,
    /** Sin PIN todavía: la pantalla siguiente le pide elegir uno. */
    debeElegirPin: !acceso.hasPin,
  });

  response.cookies.set(PORTAL_COOKIE, token, PORTAL_COOKIE_OPTIONS);
  // Identifica el dispositivo para poder pedir solo el PIN la próxima vez.
  response.cookies.set(
    DEVICE_COOKIE,
    await createDeviceToken(id, acceso.id),
    DEVICE_COOKIE_OPTIONS,
  );
  return response;
}
