"use client";

import { upload } from "@vercel/blob/client";
import { formatBytes } from "@/lib/archivos";

/** Lo que se guarda de un archivo ya subido: la fila de la base sale de aquí. */
export type ArchivoListo = {
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

/**
 * Sube un archivo del navegador directamente a Vercel Blob.
 *
 * No pasa por el servidor de Konnect: una petición a una función de Vercel se
 * corta en 4,5 MB, así que por ahí no entraba ni un video corto. El servidor
 * solo firma el permiso (`/api/blob/subir`) y después recibe la dirección del
 * archivo, que es un dato pequeño.
 *
 * Se comprueba aquí el tipo y el tamaño para no hacer esperar a nadie a que
 * suban 80 MB y entonces decirle que ese formato no vale. El permiso los
 * comprueba otra vez en el servidor, que es lo que de verdad manda.
 */
export async function subirABlob(
  archivo: File,
  opciones: { carpeta: string; tipos: string[]; maximo: number },
): Promise<ArchivoListo> {
  if (!opciones.tipos.includes(archivo.type)) {
    throw new Error(`Ese tipo de archivo no se admite (${archivo.type || "desconocido"}).`);
  }
  if (archivo.size > opciones.maximo) {
    throw new Error(
      `El archivo pesa ${formatBytes(archivo.size)} y el máximo son ${formatBytes(opciones.maximo)}.`,
    );
  }

  const subido = await upload(`${opciones.carpeta}/${archivo.name}`, archivo, {
    access: "public",
    handleUploadUrl: "/api/blob/subir",
    // Se parte en trozos y se reintenta lo que falle: en móvil, una subida
    // larga de una sola pieza se cae con cualquier bache de cobertura.
    multipart: archivo.size > 5 * 1024 * 1024,
  });

  return {
    url: subido.url,
    fileName: archivo.name,
    fileSize: archivo.size,
    contentType: archivo.type,
  };
}

/** Mete el archivo ya subido en un formulario, como lo esperan las rutas. */
export function ponerArchivo(form: FormData, listo: ArchivoListo) {
  form.set("blobUrl", listo.url);
  form.set("blobName", listo.fileName);
  form.set("blobSize", String(listo.fileSize));
  form.set("blobType", listo.contentType);
}
