import { put } from "@vercel/blob";

// Los límites y los tipos viven en `lib/archivos`, sin SDK, para que también
// los puedan leer los formularios del navegador. Se reexportan porque las
// rutas de API los piden junto con la subida.
export * from "@/lib/archivos";

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

/** ¿El formulario trae archivo, ya sea subido o por subir? */
export function traeArchivo(form: FormData): boolean {
  const archivo = form.get("archivo");
  return Boolean(form.get("blobUrl")) || (archivo instanceof File && archivo.size > 0);
}

/**
 * El archivo de un formulario, venga como venga.
 *
 * Lo normal es que el navegador lo haya subido ya a Blob y aquí solo lleguen
 * su dirección y sus datos (`blobUrl`, `blobName`…): una petición a una
 * función de Vercel se corta en 4,5 MB, así que mandar el archivo entero al
 * servidor solo funciona con los pequeños. Se sigue aceptando ese camino
 * —`archivo`— porque en local no hay tal límite y es más simple de probar.
 */
export async function archivoDeFormulario(
  form: FormData,
  opciones: { carpeta: string; tipos: string[]; maximo: number },
): Promise<ArchivoSubido | FalloSubida> {
  const url = String(form.get("blobUrl") ?? "").trim();
  if (!url) return subirArchivo(form.get("archivo"), opciones);

  if (!esDeNuestroBlob(url)) {
    return { error: "Esa dirección no es de un archivo subido a Konnect.", status: 400 };
  }

  const contentType = String(form.get("blobType") ?? "");
  if (!opciones.tipos.includes(contentType)) {
    return { error: `Ese tipo de archivo no se admite (${contentType || "desconocido"}).`, status: 415 };
  }

  const fileSize = Number(form.get("blobSize")) || 0;
  if (fileSize > opciones.maximo) {
    const mb = Math.round(opciones.maximo / 1024 / 1024);
    return { error: `El archivo pesa demasiado. El máximo son ${mb} MB.`, status: 413 };
  }

  return {
    url,
    fileName: String(form.get("blobName") ?? "").slice(0, 200) || "archivo",
    fileSize,
    contentType,
  };
}

/**
 * La dirección es de nuestro store de Blob.
 *
 * El navegador manda la dirección después de subir, así que alguien podría
 * mandar otra cualquiera y dejar en la sesión un enlace a un sitio ajeno con
 * pinta de archivo nuestro. El permiso de subida ya limita dónde y cuánto;
 * esto cierra el resto.
 */
function esDeNuestroBlob(url: string): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    host = u.hostname;
  } catch {
    return false;
  }
  if (!host.endsWith(".public.blob.vercel-storage.com")) return false;

  // El host es el id del store sin el prefijo «store_», en minúsculas. Si la
  // variable no está puesta, basta con que sea un host de Blob.
  const store = process.env.BLOB_STORE_ID?.replace(/^store_/, "").toLowerCase();
  return !store || host.startsWith(`${store}.`);
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
