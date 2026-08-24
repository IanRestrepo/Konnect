/**
 * Siembra la lista de creadores leyendo sus datos públicos reales de YouTube.
 *
 *   node scripts/seed-creadores.mjs
 *
 * Las métricas (nombre, foto, suscriptores, vistas, videos) vienen de la API.
 * Las tarifas son marcadores de posición para que la interfaz no quede en cero;
 * el contacto y los datos bancarios se dejan vacíos a propósito: eso lo llena
 * la agencia, no se inventa.
 *
 * Para cambiar un canal, edita su `handle` aquí y vuelve a ejecutar.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const CANALES = [
  { handle: "sharkblox", categoria: "Gaming", rateVideo: 4500, rateShort: 1400, rateIntegration: 2000 },
  { handle: "robuilder", categoria: "Gaming", rateVideo: 1600, rateShort: 550, rateIntegration: 750 },
  { handle: "aekagraclips", categoria: "Gaming", rateVideo: 1500, rateShort: 500, rateIntegration: 700 },
  { handle: "roxicakegamer", categoria: "Gaming", rateVideo: 12000, rateShort: 4000, rateIntegration: 5500 },
];

const FILE = path.join(process.cwd(), ".data", "konnect.json");

function leerClave(texto) {
  const match = /^YOUTUBE_API_KEY\s*=\s*"?([^"\r\n]+)"?/m.exec(texto);
  return match?.[1]?.trim() || null;
}

async function claveDeEntorno() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  for (const archivo of [".env.local", ".env"]) {
    try {
      const clave = leerClave(await fs.readFile(path.join(process.cwd(), archivo), "utf8"));
      if (clave) return clave;
    } catch {
      // seguimos buscando
    }
  }
  return null;
}

function id(prefijo) {
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function traerCanal(handle, key) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("forHandle", handle);
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube respondió ${res.status} para @${handle}`);

  const item = (await res.json()).items?.[0];
  if (!item) throw new Error(`No existe el canal @${handle}`);
  return item;
}

const main = async () => {
  const key = await claveDeEntorno();
  if (!key) {
    console.error("Falta YOUTUBE_API_KEY en .env.local");
    process.exit(1);
  }

  const db = JSON.parse(await fs.readFile(FILE, "utf8"));
  const ahora = new Date().toISOString();
  const creadores = [];

  for (const canal of CANALES) {
    const item = await traerCanal(canal.handle, key);
    const thumbs = item.snippet.thumbnails ?? {};

    creadores.push({
      id: id("cr"),
      name: item.snippet.title,
      handle: item.snippet.customUrl ?? `@${canal.handle}`,
      channelId: item.id,
      channelUrl: `https://www.youtube.com/${item.snippet.customUrl ?? `@${canal.handle}`}`,
      avatarUrl: thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
      country: item.snippet.country ?? "",
      category: canal.categoria,
      status: "activo",
      email: "",
      phone: "",
      totalViews: Number(item.statistics.viewCount ?? 0),
      subscribers: Number(item.statistics.subscriberCount ?? 0),
      videoCount: Number(item.statistics.videoCount ?? 0),
      metricsUpdatedAt: ahora,
      currency: "USD",
      rateVideo: canal.rateVideo,
      rateShort: canal.rateShort,
      rateIntegration: canal.rateIntegration,
      paymentMethods: ["transferencia"],
      banking: { holder: "", bankName: "", accountNumber: "", routing: "", taxId: "" },
      notes: "Tarifas de referencia: ajústalas al acuerdo real.",
      createdAt: ahora,
    });

    console.log(
      `${item.snippet.title.padEnd(22)} ${String(item.statistics.subscriberCount).padStart(10)} subs  ` +
        `${Number(item.statistics.viewCount).toLocaleString("es").padStart(15)} vistas`,
    );
  }

  db.creators = creadores;
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  console.log(`\n${creadores.length} creadores escritos en .data/konnect.json`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
