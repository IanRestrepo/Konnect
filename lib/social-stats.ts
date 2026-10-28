/**
 * Seguidores de TikTok e Instagram, leídos con Apify.
 *
 * YouTube tiene una API pública; TikTok e Instagram no dan la cifra de una
 * cuenta cualquiera, y leer su página desde el servidor no funciona: las dos
 * la bloquean. Apify ofrece lectores de perfiles públicos ya mantenidos, que
 * se pagan por consulta. Con `APIFY_TOKEN` en el entorno se usan; sin él,
 * los seguidores se siguen escribiendo a mano en «Redes sociales».
 *
 * Solo corre en el servidor: el token no puede llegar al navegador.
 */

import type { SocialPlatform } from "@/lib/types";

/** Lector de Apify para cada red. El id lleva «~» entre dueño y nombre. */
const LECTORES: Partial<Record<SocialPlatform, { actor: string; entrada: (usuario: string) => object }>> = {
  tiktok: {
    actor: "clockworks~tiktok-profile-scraper",
    // Basta con el perfil: un solo video para no pagar por los demás.
    entrada: (usuario) => ({
      profiles: [usuario],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    }),
  },
  instagram: {
    actor: "apify~instagram-profile-scraper",
    entrada: (usuario) => ({ usernames: [usuario] }),
  },
};

export const REDES_CON_LECTOR = Object.keys(LECTORES) as SocialPlatform[];

export function lectorConfigurado(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

export type DatosRed = {
  followers: number;
  /** Publicaciones o videos, si el lector los trae. */
  posts: number | null;
};

/** Busca un número en las claves que usa cada lector, sin depender de una sola. */
function numero(obj: unknown, claves: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  for (const k of claves) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Lee los seguidores de una cuenta. Lanza con un mensaje en español si algo
 * falla, para que la pantalla diga por qué.
 */
export async function leerRed(platform: SocialPlatform, handle: string): Promise<DatosRed> {
  const lector = LECTORES[platform];
  const token = process.env.APIFY_TOKEN;
  if (!lector) throw new Error("Esta red no tiene lectura automática.");
  if (!token) throw new Error("Falta APIFY_TOKEN en el entorno.");

  const usuario = handle.trim().replace(/^@/, "").replace(/\/+$/, "").split("/").pop() ?? "";
  if (!usuario) throw new Error("La red no tiene usuario apuntado.");

  const res = await fetch(
    `https://api.apify.com/v2/acts/${lector.actor}/run-sync-get-dataset-items?timeout=50`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(lector.entrada(usuario)),
      signal: AbortSignal.timeout(55_000),
    },
  );
  if (res.status === 401 || res.status === 403) throw new Error("Apify rechazó el token.");
  if (res.status === 402) throw new Error("Se acabó el saldo de Apify.");
  if (!res.ok) throw new Error(`Apify respondió ${res.status}.`);

  const items = (await res.json()) as unknown[];
  const primero = Array.isArray(items) ? items[0] : null;
  if (!primero) throw new Error(`No se encontró @${usuario}.`);

  // TikTok trae el perfil dentro de cada video (`authorMeta`); Instagram, plano.
  const perfil =
    platform === "tiktok" ? ((primero as Record<string, unknown>).authorMeta ?? primero) : primero;
  const followers = numero(perfil, ["fans", "followers", "followerCount", "followersCount"]);
  if (followers === null) throw new Error(`No llegó la cifra de seguidores de @${usuario}.`);

  return {
    followers,
    posts: numero(perfil, ["video", "videoCount", "postsCount", "mediaCount"]),
  };
}
