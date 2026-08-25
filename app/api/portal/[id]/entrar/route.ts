import { NextResponse } from "next/server";
import { z } from "zod";
import { clearFailures, isLocked, registerFailure } from "@/lib/crypto";
import { PORTAL_COOKIE, PORTAL_COOKIE_OPTIONS, createPortalToken } from "@/lib/portal";
import { verifyPortalCode } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().min(1, "Escribe el código.") });

/**
 * Canjea un código de acceso por una sesión de portal.
 *
 * Es una ruta pública, así que se limita por sesión e IP: cinco intentos y
 * diez minutos de espera, igual que la revelación de datos bancarios.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida";
  const actor = `portal:${id}:${ip}`;

  if (isLocked(actor)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Vuelve a probar en unos minutos." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe el código." }, { status: 400 });
  }

  const acceso = await verifyPortalCode(id, parsed.data.code);
  if (!acceso) {
    const restantes = registerFailure(actor);
    // Mismo mensaje para código malo, acceso revocado y sesión cerrada.
    return NextResponse.json(
      { error: `Código no válido. Te quedan ${restantes} intentos.` },
      { status: 401 },
    );
  }

  clearFailures(actor);

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
