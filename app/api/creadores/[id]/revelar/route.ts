import { NextResponse } from "next/server";
import { revealBanking } from "@/lib/store";
import { getCreator } from "@/lib/data";
import { clearFailures, isLocked, registerFailure, verifyAccessCode } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { registrar } from "@/lib/audit";

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

  // Se descifra solo aquí: `read()` nunca saca de la base los datos completos.
  const revelado = await revealBanking(id);
  if (!revelado) {
    return NextResponse.json({ error: "Creador no encontrado." }, { status: 404 });
  }

  clearFailures(actor);
  // Con el nombre del creador: el titular de la cuenta casi nunca está puesto,
  // y la bitácora decía «reveló datos bancarios» sin decir de quién.
  const creador = await getCreator(id);
  await registrar({
    actorId: session.userId,
    actorName: session.name,
    action: "banca.revelada",
    entity: "creator",
    entityId: id,
    entityLabel: creador?.name ?? revelado.banking.holder ?? "",
    detail: "Datos bancarios y personales",
  });

  return NextResponse.json({
    banking: revelado.banking,
    accounts: revelado.accounts,
    personal: revelado.personal,
    revealedAt: new Date().toISOString(),
  });
}
