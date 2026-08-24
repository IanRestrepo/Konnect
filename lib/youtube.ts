/**
 * Integración con YouTube Data API v3 (solo datos públicos).
 *
 * Disponible sin ser dueño del canal: nombre, foto, suscriptores, vistas totales,
 * nº de videos, y por video: título, miniatura, fecha, duración, vistas, likes y comentarios.
 * NO disponible públicamente: retención, watch time, demografía, CTR e ingresos
 * (eso requiere YouTube Analytics API con OAuth del creador).
 *
 * Sin YOUTUBE_API_KEY el módulo responde en modo demo para no bloquear la UI.
 */

import { getSettings } from "@/lib/store";

const API = "https://www.googleapis.com/youtube/v3";

export type ChannelInfo = {
  channelId: string;
  name: string;
  handle: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  country: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  publishedAt: string | null;
  channelUrl: string;
  source: "api" | "demo";
};

export type VideoInfo = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string | null;
  publishedAt: string;
  durationSeconds: number;
  isShort: boolean;
  views: number;
  likes: number | null;
  comments: number | null;
  tags: string[];
  videoUrl: string;
  source: "api" | "demo";
};

/**
 * La clave puede venir del entorno o de Configuración → Integraciones.
 * El entorno gana, para no pisar despliegues.
 */
export async function resolveApiKey(): Promise<string | null> {
  const fromEnv = process.env.YOUTUBE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const stored = (await getSettings()).youtubeApiKey?.trim();
  return stored || null;
}

export async function hasApiKey() {
  return Boolean(await resolveApiKey());
}

/* ---------------- Parsers ---------------- */

type ChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "user"; value: string }
  | { kind: "custom"; value: string };

export function parseChannelRef(input: string): ChannelRef | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith("@")) return { kind: "handle", value: raw.slice(1) };
  if (/^UC[\w-]{22}$/.test(raw)) return { kind: "id", value: raw };

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { kind: "handle", value: raw };
  }

  if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== "youtu.be") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const [first, second] = segments;
  if (first.startsWith("@")) return { kind: "handle", value: first.slice(1) };
  if (first === "channel" && second) return { kind: "id", value: second };
  if (first === "user" && second) return { kind: "user", value: second };
  if (first === "c" && second) return { kind: "custom", value: second };
  return { kind: "custom", value: first };
}

export function parseVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;

  const v = url.searchParams.get("v");
  if (v) return v;

  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => ["shorts", "embed", "live", "v"].includes(s));
  if (idx >= 0 && segments[idx + 1]) return segments[idx + 1];
  return null;
}

/** ISO 8601 (PT1H2M3S) → segundos */
export function parseDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/* ---------------- Llamadas ---------------- */

async function call<T>(path: string, params: Record<string, string>, key: string): Promise<T> {

  const url = new URL(`${API}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", key);

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

type ChannelResource = {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    country?: string;
    publishedAt: string;
    thumbnails: Record<string, { url: string }>;
  };
  statistics: { viewCount: string; subscriberCount: string; videoCount: string };
  brandingSettings?: { image?: { bannerExternalUrl?: string } };
};

function bestThumb(thumbs: Record<string, { url: string }> | undefined) {
  if (!thumbs) return null;
  return thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null;
}

export async function fetchChannel(input: string): Promise<ChannelInfo> {
  const ref = parseChannelRef(input);
  if (!ref) throw new Error("El enlace no parece de un canal de YouTube.");
  const key = await resolveApiKey();
  if (!key) return demoChannel(ref);

  const part = "snippet,statistics,brandingSettings";
  let data = await (async () => {
    if (ref.kind === "id") return call<{ items?: ChannelResource[] }>("channels", { part, id: ref.value }, key);
    if (ref.kind === "handle")
      return call<{ items?: ChannelResource[] }>("channels", { part, forHandle: ref.value }, key);
    if (ref.kind === "user")
      return call<{ items?: ChannelResource[] }>("channels", { part, forUsername: ref.value }, key);
    return { items: [] as ChannelResource[] };
  })();

  // URLs personalizadas (/c/nombre) requieren búsqueda: cuestan 100 unidades de cuota.
  if (!data.items?.length) {
    const search = await call<{ items?: { snippet: { channelId: string } }[] }>("search", {
      part: "snippet",
      type: "channel",
      maxResults: "1",
      q: ref.value,
    }, key);
    const found = search.items?.[0]?.snippet.channelId;
    if (!found) throw new Error("No encontramos ese canal.");
    data = await call<{ items?: ChannelResource[] }>("channels", { part, id: found }, key);
  }

  const item = data.items?.[0];
  if (!item) throw new Error("No encontramos ese canal.");

  const handle = item.snippet.customUrl ?? (ref.kind === "handle" ? `@${ref.value}` : "");

  return {
    channelId: item.id,
    name: item.snippet.title,
    handle: handle.startsWith("@") ? handle : handle ? `@${handle}` : "",
    description: item.snippet.description ?? "",
    avatarUrl: bestThumb(item.snippet.thumbnails),
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? null,
    country: item.snippet.country ?? null,
    subscribers: Number(item.statistics.subscriberCount ?? 0),
    totalViews: Number(item.statistics.viewCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
    publishedAt: item.snippet.publishedAt ?? null,
    channelUrl: handle
      ? `https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`
      : `https://www.youtube.com/channel/${item.id}`,
    source: "api",
  };
}

type VideoResource = {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    tags?: string[];
    thumbnails: Record<string, { url: string }>;
  };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails: { duration: string };
};

export async function fetchVideo(input: string): Promise<VideoInfo> {
  const id = parseVideoId(input);
  if (!id) throw new Error("El enlace no parece de un video de YouTube.");
  const key = await resolveApiKey();
  if (!key) return demoVideo(id);

  const data = await call<{ items?: VideoResource[] }>(
    "videos",
    { part: "snippet,statistics,contentDetails", id },
    key,
  );
  const item = data.items?.[0];
  if (!item) throw new Error("Video no encontrado o privado.");

  const durationSeconds = parseDuration(item.contentDetails.duration);

  return {
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? "",
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    thumbnail: bestThumb(item.snippet.thumbnails),
    publishedAt: item.snippet.publishedAt,
    durationSeconds,
    isShort: durationSeconds > 0 && durationSeconds <= 60,
    views: Number(item.statistics.viewCount ?? 0),
    likes: item.statistics.likeCount ? Number(item.statistics.likeCount) : null,
    comments: item.statistics.commentCount ? Number(item.statistics.commentCount) : null,
    tags: item.snippet.tags ?? [],
    videoUrl: `https://www.youtube.com/watch?v=${item.id}`,
    source: "api",
  };
}

/* ---------------- Modo demo (sin API key) ---------------- */

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function demoChannel(ref: ChannelRef): ChannelInfo {
  const seed = hash(ref.value);
  const name = ref.value
    .replace(/[-_.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 40);
  const subscribers = 40_000 + (seed % 3_000_000);
  const videoCount = 60 + (seed % 900);

  return {
    channelId: `UCdemo${(seed % 1e10).toString().padStart(10, "0")}`,
    name: name || "Canal demo",
    handle: `@${ref.value.replace(/\s+/g, "").toLowerCase()}`,
    description: "Datos de demostración: configura YOUTUBE_API_KEY para leer el canal real.",
    avatarUrl: null,
    bannerUrl: null,
    country: null,
    subscribers,
    totalViews: subscribers * (35 + (seed % 90)),
    videoCount,
    publishedAt: "2019-04-12T00:00:00.000Z",
    channelUrl: `https://www.youtube.com/@${ref.value}`,
    source: "demo",
  };
}

function demoVideo(id: string): VideoInfo {
  const seed = hash(id);
  const durationSeconds = seed % 3 === 0 ? 30 + (seed % 30) : 300 + (seed % 1200);
  const views = 20_000 + (seed % 1_800_000);

  return {
    videoId: id,
    title: `Video demo ${id}`,
    description: "Datos de demostración: configura YOUTUBE_API_KEY para leer el video real.",
    channelId: `UCdemo${(seed % 1e10).toString().padStart(10, "0")}`,
    channelTitle: "Canal demo",
    thumbnail: null,
    publishedAt: new Date(Date.now() - (seed % 60) * 86_400_000).toISOString(),
    durationSeconds,
    isShort: durationSeconds <= 60,
    views,
    likes: Math.round(views * 0.045),
    comments: Math.round(views * 0.003),
    tags: [],
    videoUrl: `https://www.youtube.com/watch?v=${id}`,
    source: "demo",
  };
}
