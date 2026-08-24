import { NextResponse } from "next/server";
import { getCreator } from "@/lib/data";
import { clearFailures, isLocked, registerFailure, verifyAccessCode } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Revela los datos bancarios de un creador tras validar el código del administrador.
 * Cada intento se audita; tras 5 fallos el actor queda bloqueado 10 minutos.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Dos barreras: el permiso del rol y, además, el código.
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "ver_datos_bancarios")) {
    return NextResponse.json(
      { error: "Tu rol no permite ver la información bancaria." },
      { status: 403 },
    );
  }

  const actor = session.userId;

  if (isLocked(actor)) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Intenta de nuevo en unos minutos." },
      { status: 429 },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: string };
    code = body.code ?? "";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!verifyAccessCode(code)) {
    const remaining = registerFailure(actor);
    return NextResponse.json(
      { error: `Código incorrecto. Te quedan ${remaining} intentos.` },
      { status: 401 },
    );
  }

  const creator = await getCreator(id);
  if (!creator) {
    return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });
  }

  clearFailures(actor);
  console.info(
    `[auditoría] datos bancarios revelados — creador= usuario= ()`,
  );

  return NextResponse.json({ banking: creator.banking, revealedAt: new Date().toISOString() });
}
