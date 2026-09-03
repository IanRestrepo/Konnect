import { put } from "@vercel/blob";

/**
 * Subida de archivos a Vercel Blob.
 *
 * Va a Blob y no a la base ni al disco por lo mismo que las imágenes de las
 * notas: en serverless no hay disco donde escribir, y un video de entrega
 * dentro de una fila de Postgres arrastraría megas en cada consulta.
 *
 * Vive aparte porque suben desde dos puertas distintas —la aplicación y el
 * portal— con permisos distintos, y los límites tienen que ser los mismos en
 * las dos: si una acepta lo que la otra rechaza, el material queda a medias.
 */

/** Lo que tiene sentido entregar en una sesión. */
export const TIPOS_MATERIAL = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/zip",
  "text/plain",
];

/** Un comprobante de pago es una captura o un PDF; nada más hace falta. */
export const TIPOS_COMPROBANTE = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

/**
 * 100 MB. Un video vertical terminado cabe; un master sin comprimir no, y es
 * mejor así: eso se comparte por enlace, no se sube a la herramienta.
 */
export const MAXIMO_MATERIAL = 100 * 1024 * 1024;

/** 8 MB de sobra para una captura o un PDF de banco. */
export const MAXIMO_COMPROBANTE = 8 * 1024 * 1024;

export type ArchivoSubido = {
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

/** Fallo de subida ya traducido: el mensaje sale tal cual en la interfaz. */
export type FalloSubida = { error: string; status: number };

export function esFallo(r: ArchivoSubido | FalloSubida): r is FalloSubida {
  return "error" in r;
}

/**
 * Valida y sube un archivo. Devuelve el fallo en vez de lanzarlo para que cada
 * ruta decida el código y el mensaje sin envolver excepciones.
 */
export async function subirArchivo(
  archivo: unknown,
  opciones: { carpeta: string; tipos: string[]; maximo: number },
): Promise<ArchivoSubido | FalloSubida> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      error:
        "Falta BLOB_READ_WRITE_TOKEN. Crea el store en Vercel → Storage → Blob y copia la variable.",
      status: 501,
    };
  }

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "No llegó ningún archivo.", status: 400 };
  }
  if (!opciones.tipos.includes(archivo.type)) {
    return { error: `Ese tipo de archivo no se admite (${archivo.type || "desconocido"}).`, status: 415 };
  }
  if (archivo.size > opciones.maximo) {
    const mb = Math.round(opciones.maximo / 1024 / 1024);
    return { error: `El archivo pesa demasiado. El máximo son ${mb} MB.`, status: 413 };
  }

  try {
    const { url } = await put(`${opciones.carpeta}/${Date.now()}-${archivo.name}`, archivo, {
      access: "public",
      // Evita que dos archivos con el mismo nombre se pisen.
      addRandomSuffix: true,
    });
    return {
      url,
      fileName: archivo.name,
      fileSize: archivo.size,
      contentType: archivo.type,
    };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "";
    return { error: `No se pudo subir el archivo. ${detalle}`.trim(), status: 502 };
  }
}

/** Peso legible, para no enseñar «13631488» al lado del nombre. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const unidades = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${unidades[i]}`;
}
