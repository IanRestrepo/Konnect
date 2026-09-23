import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { MAXIMO_NOTA, TIPOS_NOTA, archivoDeFormulario, esFallo } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Guarda la imagen pegada en una nota.
 *
 * El archivo lo sube el navegador directamente a Vercel Blob —una petición a
 * una función de Vercel se corta en 4,5 MB, y una foto de móvil se pasa— y
 * aquí solo llega su dirección, que es lo que se incrusta en el documento.
 */
export async function POST(request: Request) {
  await requirePermission("editar_notas");

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const subido = await archivoDeFormulario(form, {
    carpeta: "notas",
    tipos: TIPOS_NOTA,
    maximo: MAXIMO_NOTA,
  });
  if (esFallo(subido)) {
    return NextResponse.json({ error: subido.error }, { status: subido.status });
  }

  return NextResponse.json({ url: subido.url });
}
