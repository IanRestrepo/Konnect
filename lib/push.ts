import webpush from "web-push";

/**
 * Notificaciones push del equipo (Web Push con claves VAPID).
 *
 * Las claves se generan una vez y viven en el entorno: `VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY` y, opcional, `VAPID_SUBJECT`. Sin ellas no se manda
 * nada, pero tampoco se rompe nada: el aviso queda en la campana de la
 * aplicación igual, que es donde se lee.
 *
 * Solo corre en Node: `web-push` usa `node:crypto`, así que esto no puede
 * acabar en el middleware.
 */

let listo: boolean | null = null;

function configurar(): boolean {
  if (listo !== null) return listo;
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    listo = false;
    return listo;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:avisos@konectnetwork.com",
    publica,
    privada,
  );
  listo = true;
  return listo;
}

/** La clave pública, para que el navegador pueda suscribirse. Null = sin configurar. */
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export type DestinoPush = { endpoint: string; p256dh: string; auth: string };

export type AvisoPush = {
  title: string;
  body: string;
  /** A dónde lleva al tocarlo. */
  url: string;
  /**
   * Avisos con la misma etiqueta se sustituyen en vez de apilarse: los
   * recordatorios de una sesión no llenan la bandeja de diez avisos iguales.
   */
  tag: string;
};

/**
 * Manda el aviso a cada suscripción y devuelve las que ya no existen, para
 * borrarlas. Un fallo con un dispositivo no frena a los demás.
 */
export async function enviarPush(destinos: DestinoPush[], aviso: AvisoPush): Promise<string[]> {
  if (destinos.length === 0 || !configurar()) return [];

  const muertas: string[] = [];
  await Promise.allSettled(
    destinos.map(async (d) => {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          JSON.stringify(aviso),
          // Doce horas: después el último recordatorio ya habrá salido, y un
          // aviso de ayer que llega hoy solo confunde.
          { TTL: 60 * 60 * 12, urgency: "high", timeout: 8000 },
        );
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) muertas.push(d.endpoint);
        else console.error("No se pudo mandar un aviso push:", codigo ?? e);
      }
    }),
  );
  return muertas;
}
