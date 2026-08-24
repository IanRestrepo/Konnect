import type { SocialPlatform } from "@/lib/types";

/** Cómo se muestra y cómo se arma el enlace de cada plataforma. */
export const PLATFORMS: { id: SocialPlatform; label: string; placeholder: string }[] = [
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
