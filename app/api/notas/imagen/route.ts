import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Lo que Vercel Blob acepta y tiene sentido pegar en una nota. */
const TIPOS = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

/** 8 MB: una captura o una foto de móvil caben de sobra. */
const MAXIMO = 8 * 1024 * 1024;

/**
 * Sube una imagen pegada en una nota.
 *
 * Va a Vercel Blob y no a la base ni al disco: en serverless no hay disco
 * donde escribir, y meter la imagen en base64 dentro del documento hincharía
 * la fila y arrastraría megas en cada carga de la nota.
 */
export async function POST(request: Request) {
  await requirePermission("editar_notas");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Falta BLOB_READ_WRITE_TOKEN. Crea el store en Vercel → Storage → Blob y copia la variable.",
      },
      { status: 501 },
    );
  }

  const form = await request.formData().catch(() => null);
  const archivo = form?.get("archivo");

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "No llegó ninguna imagen." }, { status: 400 });
  }
  if (!TIPOS.includes(archivo.type)) {
    return NextResponse.json(
      { error: "Solo PNG, JPG, GIF, WebP o AVIF." },
      { status: 415 },
    );
  }
  if (archivo.size > MAXIMO) {
    return NextResponse.json(
      { error: `La imagen pesa demasiado. El máximo son ${MAXIMO / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  try {
    const { url } = await put(`notas/${Date.now()}-${archivo.name}`, archivo, {
      access: "public",
      // Evita que dos capturas llamadas «imagen.png» se pisen.
      addRandomSuffix: true,
    });
    return NextResponse.json({ url });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "";
    return NextResponse.json(
      { error: `No se pudo subir la imagen. ${detalle}`.trim() },
      { status: 502 },
    );
  }
}
