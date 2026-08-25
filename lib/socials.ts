import type { SocialPlatform } from "@/lib/types";

/** Cómo se muestra y cómo se arma el enlace de cada plataforma. */
export const PLATFORMS: { id: SocialPlatform; label: string; placeholder: string }[] = [
  { id: "youtube", label: "YouTube", placeholder: "usuario" },
  { id: "instagram", label: "Instagram", placeholder: "usuario" },
  { id: "tiktok", label: "TikTok", placeholder: "usuario" },
  { id: "x", label: "X", placeholder: "usuario" },
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
