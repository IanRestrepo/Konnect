/**
 * Qué se puede subir y cuánto puede pesar.
 *
 * Vive aparte de `lib/uploads` porque estos límites los necesitan también los
 * formularios del navegador, y `uploads` trae el SDK de Vercel Blob, que es
 * código de servidor y no tiene por qué acabar en el paquete que descarga
 * quien abre la aplicación.
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
export const TIPOS_COMPROBANTE = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/** Lo que se puede pegar dentro de una nota. */
export const TIPOS_NOTA = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

/** Capturas de estadísticas: solo imágenes, que es lo que se enseña en la ficha. */
export const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp"];

/**
 * 100 MB. Un video vertical terminado cabe; un master sin comprimir no, y es
 * mejor así: eso se comparte por enlace, no se sube a la herramienta.
 */
export const MAXIMO_MATERIAL = 100 * 1024 * 1024;

/** 8 MB de sobra para una captura o un PDF de banco. */
export const MAXIMO_COMPROBANTE = 8 * 1024 * 1024;

/** 8 MB: una captura o una foto de móvil caben de sobra. */
export const MAXIMO_NOTA = 8 * 1024 * 1024;

/** Un pantallazo de móvil o de escritorio cabe de sobra. */
export const MAXIMO_CAPTURA = 10 * 1024 * 1024;

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
