import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Compara sin filtrar por el tiempo de respuesta cuántos caracteres acertó. */
function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Manda los recordatorios de avisos sin abrir.
 *
 * No la llama nadie del equipo: la llama un cron cada pocos minutos con
 * `Authorization: Bearer <CRON_SECRET>`. Por eso queda fuera del middleware
 * de sesión y comprueba el secreto ella misma. Sin secreto configurado no
 * hace nada: una ruta abierta que manda push a todo el equipo no es buena idea.
 */
async function recordar(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "Falta CRON_SECRET en el entorno." }, { status: 503 });
  }
  const llega = request.headers.get("authorization") ?? "";
  if (!igual(llega, `Bearer ${secreto}`)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const enviados = await sendDueReminders();
  return NextResponse.json({ enviados });
}

export const GET = recordar;
export const POST = recordar;
