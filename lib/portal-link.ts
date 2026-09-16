import { headers } from "next/headers";

/**
 * Dirección absoluta del portal de una sesión, sin la llave del acceso.
 *
 * Se arma en el servidor con las cabeceras de la petición: leer `window`
 * durante el render rompía la hidratación y dejaba la página sin botones. La
 * llave se añade al copiar, con `?acceso=`, porque es distinta para cada
 * persona.
 */
export async function portalBase(sessionId: string): Promise<string> {
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "";
  const protocolo =
    cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return host ? `${protocolo}://${host}/portal/${sessionId}` : `/portal/${sessionId}`;
}

/** El enlace personal de un acceso: el portal con su llave dentro. */
export function enlacePersonal(base: string, code: string): string {
  return `${base}?acceso=${encodeURIComponent(code)}`;
}
