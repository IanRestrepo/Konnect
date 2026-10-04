import type { CreatorChannel, DeliverableType, SocialPlatform } from "@/lib/types";

/**
 * Cómo se nombra un canal secundario.
 *
 * Manda el @handle y no la etiqueta: la etiqueta nace «Secundario» y casi nadie
 * la cambia, así que un creador con dos canales extra acababa con dos
 * «Secundario» en su lista de precios y no había forma de saber cuál era cuál.
 */
export function nombreCanal(
  canal: Pick<CreatorChannel, "handle" | "label" | "channelId">,
): string {
  return canal.handle || canal.label || canal.channelId || "Canal";
}

/** Cómo se muestra y cómo se arma el enlace de cada plataforma. */
export const PLATFORMS: { id: SocialPlatform; label: string; placeholder: string }[] = [
  { id: "youtube", label: "YouTube", placeholder: "usuario" },
  { id: "instagram", label: "Instagram", placeholder: "usuario" },
  { id: "tiktok", label: "TikTok", placeholder: "usuario" },
  // Sigue llamándose Twitter en media agencia: sin la palabra, nadie lo encuentra.
  { id: "x", label: "X (Twitter)", placeholder: "usuario" },
  { id: "twitch", label: "Twitch", placeholder: "usuario" },
  { id: "kick", label: "Kick", placeholder: "usuario" },
  // Lo que interesa a una marca es su comunidad, no su usuario personal.
  { id: "discord", label: "Discord", placeholder: "invitación al servidor (discord.gg/…)" },
  { id: "roblox", label: "Roblox", placeholder: "usuario o id de grupo" },
  { id: "web", label: "Sitio web", placeholder: "https://…" },
];

export const PLATFORM_LABEL: Record<SocialPlatform, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p.label]),
) as Record<SocialPlatform, string>;

/** Limpia el arroba y arma la URL pública de cada red. */
const ARMAR_URL: Record<SocialPlatform, (usuario: string) => string> = {
  youtube: (u) => `https://youtube.com/@${u}`,
  instagram: (u) => `https://instagram.com/${u}`,
  tiktok: (u) => `https://tiktok.com/@${u}`,
  x: (u) => `https://x.com/${u}`,
  twitch: (u) => `https://twitch.tv/${u}`,
  kick: (u) => `https://kick.com/${u}`,
  discord: (u) => `https://discord.gg/${u}`,
  roblox: (u) => `https://www.roblox.com/search/users?keyword=${encodeURIComponent(u)}`,
  web: (u) => `https://${u}`,
};

const esDireccion = (h: string) => /^https?:\/\//i.test(h.trim());

/**
 * La dirección pública de un perfil.
 *
 * Mucha gente pega la dirección entera en vez del usuario. Si ya es una
 * dirección se deja tal cual: antes solo algunas redes lo comprobaban, y un
 * TikTok pegado como enlace acababa en «tiktok.com/@https://www.tiktok.com/…».
 */
export const PLATFORM_URL: Record<SocialPlatform, (handle: string) => string> = Object.fromEntries(
  PLATFORMS.map((p) => [
    p.id,
    (h: string) => (esDireccion(h) ? h.trim() : ARMAR_URL[p.id](h.trim().replace(/^@/, ""))),
  ]),
) as Record<SocialPlatform, (handle: string) => string>;

/**
 * Cómo se lee un perfil en pantalla: «@musashii_» y no la dirección entera.
 *
 * Si lo guardado es un usuario, se deja. Si es una dirección, se saca el
 * usuario de la ruta; cuando la ruta no lo trae —una invitación de Discord, un
 * perfil de Roblox por número— se dice qué es en vez de enseñar un código.
 */
export function usuarioRed(platform: SocialPlatform, handle: string): string {
  const h = handle.trim();
  if (!esDireccion(h)) return h;
  let partes: string[] = [];
  try {
    partes = new URL(h).pathname.split("/").filter(Boolean);
  } catch {
    return h;
  }
  if (platform === "discord") return "Servidor de Discord";
  if (platform === "web") return h.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  const conArroba = partes.find((p) => p.startsWith("@"));
  if (conArroba) return conArroba;
  if (platform === "roblox") return "Perfil de Roblox";
  // youtube.com/channel/UC…: un id, no un nombre.
  if (partes[0] === "channel") return "Canal de YouTube";
  const ultimo = partes[partes.length - 1];
  return ultimo ? `@${ultimo}` : h;
}

/**
 * Cómo llama cada plataforma a sus métricas. Un TikToker no tiene
 * "suscriptores" ni "vistas del canal", y llamárselo delata la herramienta.
 */
export const PLATFORM_METRICS: Record<
  SocialPlatform,
  { audience: string; audienceShort: string; views: string; content: string }
> = {
  youtube: {
    audience: "Suscriptores",
    audienceShort: "subs",
    views: "Vistas del canal",
    content: "Videos",
  },
  instagram: {
    audience: "Seguidores",
    audienceShort: "seguidores",
    views: "Reproducciones",
    content: "Publicaciones",
  },
  tiktok: {
    audience: "Seguidores",
    audienceShort: "seguidores",
    views: "Reproducciones",
    content: "Videos",
  },
  x: {
    audience: "Seguidores",
    audienceShort: "seguidores",
    views: "Impresiones",
    content: "Publicaciones",
  },
  twitch: {
    audience: "Seguidores",
    audienceShort: "seguidores",
    views: "Vistas",
    content: "Directos",
  },
  kick: {
    audience: "Seguidores",
    audienceShort: "seguidores",
    views: "Vistas",
    content: "Directos",
  },
  discord: {
    audience: "Miembros",
    audienceShort: "miembros",
    views: "Mensajes",
    content: "Canales",
  },
  roblox: {
    audience: "Seguidores",
    audienceShort: "seguidores",
    views: "Visitas",
    content: "Experiencias",
  },
  web: {
    audience: "Audiencia",
    audienceShort: "audiencia",
    views: "Visitas",
    content: "Publicaciones",
  },
};

/* ---------------- Tareas por plataforma ---------------- */

/**
 * Qué se le puede encargar a un creador en cada red, y cómo se llama allí.
 *
 * El mismo formato cambia de nombre según dónde se publique: un vertical corto
 * es un Reel en Instagram, un Short en YouTube y sencillamente un video en
 * TikTok. Encargar «short» sin más obliga al equipo a traducir mentalmente.
 */
export const TAREAS: Record<SocialPlatform, { type: DeliverableType; label: string }[]> = {
  youtube: [
    { type: "video", label: "Video dedicado" },
    { type: "integracion", label: "Mención dentro de un video" },
    { type: "short", label: "Short" },
    { type: "directo", label: "Directo" },
  ],
  instagram: [
    { type: "short", label: "Reel" },
    { type: "post", label: "Publicación" },
    { type: "directo", label: "Historia en vivo" },
  ],
  tiktok: [
    { type: "short", label: "Video" },
    { type: "integracion", label: "Mención en un video" },
    { type: "directo", label: "Directo" },
  ],
  x: [
    { type: "post", label: "Publicación" },
    { type: "video", label: "Video" },
  ],
  twitch: [
    { type: "directo", label: "Directo patrocinado" },
    { type: "integracion", label: "Mención durante el directo" },
  ],
  kick: [
    { type: "directo", label: "Directo patrocinado" },
    { type: "integracion", label: "Mención durante el directo" },
  ],
  discord: [
    { type: "post", label: "Anuncio en el servidor" },
    { type: "directo", label: "Evento en vivo" },
  ],
  roblox: [
    { type: "integracion", label: "Integración en la experiencia" },
    { type: "video", label: "Video del juego" },
  ],
  web: [{ type: "post", label: "Publicación" }],
};

/**
 * Cómo se llama una pieza concreta.
 *
 * El nombre propio manda sobre el de fábrica: si la agencia pactó un
 * «Unboxing», eso es lo que tiene que leer el equipo y lo que tiene que leer
 * el creador en su portal, no «Video dedicado», que es solo la familia de la
 * que cuelga para efectos de tarifa.
 */
export function piezaLabel(
  platform: SocialPlatform,
  type: DeliverableType,
  customType?: string | null,
): string {
  return customType?.trim() || tareaLabel(platform, type);
}

/** Cómo se llama esa tarea en esa red. Cae en un nombre genérico si no encaja. */
export function tareaLabel(platform: SocialPlatform, type: DeliverableType): string {
  const encontrada = TAREAS[platform]?.find((t) => t.type === type);
  if (encontrada) return encontrada.label;

  const generico: Record<DeliverableType, string> = {
    video: "Video",
    short: "Vertical corto",
    integracion: "Mención",
    directo: "Directo",
    post: "Publicación",
  };
  return generico[type];
}
