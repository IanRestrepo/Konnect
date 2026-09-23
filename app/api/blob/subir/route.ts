import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { PORTAL_COOKIE, puedeEntregar, puedeSubirMaterial, readPortalToken } from "@/lib/portal";
import {
  MAXIMO_CAPTURA,
  MAXIMO_COMPROBANTE,
  MAXIMO_MATERIAL,
  MAXIMO_NOTA,
  TIPOS_COMPROBANTE,
  TIPOS_IMAGEN,
  TIPOS_MATERIAL,
  TIPOS_NOTA,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Permiso para subir un archivo directamente a Blob.
 *
 * El archivo ya no pasa por aquí: el navegador lo manda a Vercel Blob y esta
 * ruta solo firma un permiso de un minuto para esa carpeta, con sus tipos y su
 * tamaño. Hacía falta porque una petición a una función de Vercel no puede
 * pasar de 4,5 MB, así que un video de entrega —o una captura grande— fallaba
 * aunque el límite de la aplicación fuera de 100 MB.
 *
 * La carpeta dice de qué es el archivo, y de ahí sale quién puede subirlo.
 */
async function permiso(
  pathname: string,
): Promise<{ tipos: string[]; maximo: number }> {
  const [carpeta, id] = pathname.split("/");
  const equipo = await getSession();
  const puede = (llave: Parameters<typeof hasPermission>[1]) =>
    Boolean(equipo && hasPermission(equipo.permissions, llave));

  switch (carpeta) {
    case "sesiones": {
      if (puede("editar_sesiones")) return { tipos: TIPOS_MATERIAL, maximo: MAXIMO_MATERIAL };

      // El portal: el creador y el cliente suben a su propia sesión y a
      // ninguna otra. El token va atado a ella.
      const galleta = await cookies();
      const portal = await readPortalToken(galleta.get(PORTAL_COOKIE)?.value);
      if (portal && portal.sessionId === id && (puedeSubirMaterial(portal) || puedeEntregar(portal))) {
        return { tipos: TIPOS_MATERIAL, maximo: MAXIMO_MATERIAL };
      }
      break;
    }
    // Lo que se le paga a un creador y lo que se le cobra al cliente: los dos
    // son comprobantes, y los dos los lleva quien lleva la campaña.
    case "comprobantes":
    case "cobros":
      if (puede("editar_campanas")) return { tipos: TIPOS_COMPROBANTE, maximo: MAXIMO_COMPROBANTE };
      break;
    // Material común de una campaña: va a todas sus sesiones.
    case "campanas":
      if (puede("editar_campanas") || puede("editar_sesiones")) {
        return { tipos: TIPOS_MATERIAL, maximo: MAXIMO_MATERIAL };
      }
      break;
    case "stats":
      if (puede("editar_creadores")) return { tipos: TIPOS_IMAGEN, maximo: MAXIMO_CAPTURA };
      break;
    case "notas":
      if (puede("editar_notas")) return { tipos: TIPOS_NOTA, maximo: MAXIMO_NOTA };
      break;
  }

  throw new Error("No tienes permiso para subir aquí.");
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    const respuesta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const { tipos, maximo } = await permiso(pathname);
        return {
          allowedContentTypes: tipos,
          maximumSizeInBytes: maximo,
          // Dos archivos con el mismo nombre no se pisan, y nadie puede
          // sobrescribir el de otro adivinando la ruta.
          addRandomSuffix: true,
          allowOverwrite: false,
          // Un minuto: lo que tarda en empezar la subida, no en terminarla.
          validUntil: Date.now() + 60_000,
        };
      },
      // La fila en la base la escribe la ruta de siempre cuando el navegador
      // avisa de que terminó; aquí no hay nada que guardar.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(respuesta);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo autorizar la subida.";
    return NextResponse.json({ error: mensaje }, { status: 403 });
  }
}
