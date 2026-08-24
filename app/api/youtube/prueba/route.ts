import { NextResponse } from "next/server";
import { fetchChannel, resolveApiKey } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/** Comprueba contra un canal real que la clave funciona y que hay cuota. */
export async function POST() {
  const key = await resolveApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "No hay clave configurada: la app responde en modo demo." },
      { status: 400 },
    );
  }

  try {
    const channel = await fetchChannel("https://www.youtube.com/@YouTube");
    return NextResponse.json({
      ok: true,
      message: `Conexión correcta. Canal de prueba: ${channel.name}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
