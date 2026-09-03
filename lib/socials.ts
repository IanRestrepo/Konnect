import type { DeliverableType, SocialPlatform } from "@/lib/types";

/** Cómo se muestra y cómo se arma el enlace de cada plataforma. */
export const PLATFORMS: { id: SocialPlatform; label: string; placeholder: string }[] = [
  { id: "youtube", label: "YouTube", placeholder: "usuario" },
  { id: "instagram", label: "Instagram", placeholder: "usuario" },
  { id: "tiktok", label: "TikTok", placeholder: "usuario" },
  // Sigue llamándose Twitter en media agencia: sin la palabra, nadie lo encuentra.
  { id: "x", label: "X (Twitter)", placeholder: "usuario" },
  { id: "twitch", label: "Twitch", placeholder: "usuario" },
  { id: "kick", label: "Kick", placeholder: "usuario" },
  { id: "discord", label: "Discord", placeholder: "invitación o usuario" },
  { id: "roblox", label: "Roblox", placeholder: "usuario o id de grupo" },
  { id: "web", label: "Sitio web", placeholder: "https://…" },
];

export const PLATFORM_LABEL: Record<SocialPlatform, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p.label]),
) as Record<SocialPlatform, string>;

/** Limpia el arroba y arma la URL pública de cada red. */
export const PLATFORM_URL: Record<SocialPlatform, (handle: string) => string> = {
  youtube: (h) =>
    h.startsWith("http") ? h : `https://youtube.com/@${h.replace(/^@/, "")}`,
  instagram: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  tiktok: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  x: (h) => `https://x.com/${h.replace(/^@/, "")}`,
  twitch: (h) => `https://twitch.tv/${h.replace(/^@/, "")}`,
  kick: (h) => `https://kick.com/${h.replace(/^@/, "")}`,
  discord: (h) =>
    h.startsWith("http") ? h : `https://discord.gg/${h.replace(/^https?:\/\/discord\.gg\//, "")}`,
  roblox: (h) =>
    h.startsWith("http") ? h : `https://www.roblox.com/search/users?keyword=${encodeURIComponent(h)}`,
  web: (h) => (h.startsWith("http") ? h : `https://${h}`),
};

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
