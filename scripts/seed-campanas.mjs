/**
 * Siembra empresas cliente y campañas, usando videos reales de los creadores
 * ya sembrados como entregables.
 *
 *   node scripts/seed-creadores.mjs   (primero)
 *   node scripts/seed-campanas.mjs
 *
 * Las empresas y los presupuestos son ficticios: son los acuerdos de la
 * agencia y no hay forma de deducirlos. Lo que sí es real son los videos y
 * sus métricas (vistas, likes, comentarios, duración y fecha de publicación),
 * que se leen de la API de YouTube.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".data", "konnect.json");

const EMPRESAS = [
  {
    key: "blackbull",
    name: "BlackBull Studios",
    industry: "Gaming",
    website: "https://blackbull.studio",
    contactName: "Mateo Aguirre",
    contactRole: "Head of Marketing",
    email: "mateo@blackbull.studio",
    phone: "+57 310 448 2210",
    socials: { youtube: "@blackbullstudios", tiktok: "@blackbullstudios" },
    status: "activo",
    notes:
      "Estudio de desarrollo en Roblox. Cliente principal de la agencia: promoción de su juego Bull Rush.",
  },
  {
    key: "voxel",
    name: "Voxel Interactive",
    industry: "Gaming",
    website: "https://voxelinteractive.gg",
    contactName: "Ana Restrepo",
    contactRole: "Producer",
    email: "ana@voxelinteractive.gg",
    phone: "+57 320 771 9034",
    socials: { youtube: "@voxelinteractive" },
    status: "activo",
    notes: "Estudio mediano. Trabaja por temporadas, presupuestos acotados.",
  },
  {
    key: "pixelsnack",
    name: "Pixel Snack",
    industry: "Consumo masivo",
    website: "https://pixelsnack.com",
    contactName: "Diego Marín",
    contactRole: "Brand Manager",
    email: "diego.marin@pixelsnack.com",
    phone: "+52 55 3390 1188",
    socials: { instagram: "@pixelsnack", tiktok: "@pixelsnack" },
    status: "prospecto",
    notes: "Marca de snacks dirigida a audiencia gamer. Negociación abierta.",
  },
];

/**
 * Cada campaña dice qué creadores participan y con cuántas piezas.
 * Los videos concretos salen del canal de cada creador.
 */
const CAMPANAS = [
  {
    empresa: "blackbull",
    name: "Bull Rush — Lanzamiento global",
    status: "activa",
    objective: "lanzamiento",
    budget: 48000,
    mesInicio: -4,
    mesFin: 1,
    notes:
      "Campaña insignia del año. Objetivo: llevar jugadores al lanzamiento de Bull Rush. Mensaje central: entra con tus amigos el primer fin de semana.",
    piezas: [
      { canal: "roxicakegamer", tipo: "video" },
      { canal: "roxicakegamer", tipo: "short" },
      { canal: "sharkblox", tipo: "video" },
      { canal: "robuilder", tipo: "video" },
      { canal: "aekagraclips", tipo: "integracion" },
    ],
  },
  {
    empresa: "blackbull",
    name: "Bull Rush — Temporada 2",
    status: "activa",
    objective: "awareness",
    budget: 16000,
    mesInicio: -1,
    mesFin: 2,
    notes: "Refuerzo tras el lanzamiento: mostrar el mapa nuevo y las recompensas de temporada.",
    piezas: [
      { canal: "sharkblox", tipo: "short" },
      { canal: "robuilder", tipo: "integracion" },
    ],
  },
  {
    empresa: "voxel",
    name: "Voxel — Prueba de mundo abierto",
    status: "finalizada",
    objective: "trafico",
    budget: 9000,
    mesInicio: -5,
    mesFin: -3,
    notes: "Cerrada. Sirvió para medir qué formato convierte mejor en el público de Roblox.",
    piezas: [{ canal: "robuilder", tipo: "video" }],
  },
  {
    empresa: "pixelsnack",
    name: "Pixel Snack — Colaboración gamer",
    status: "borrador",
    objective: "conversiones",
    budget: 6500,
    mesInicio: 1,
    mesFin: 3,
    notes: "Pendiente de aprobar presupuesto. Se propone integración corta con código de descuento.",
    piezas: [],
  },
];

function id(prefijo) {
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function mesRelativo(delta) {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth() + delta, 15).toISOString();
}

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

async function api(recurso, params, key) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${recurso}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube ${res.status} en ${recurso}: ${await res.text()}`);
  return res.json();
}

function duracionEnSegundos(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return null;
  const [, d, h, min, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/** Últimos videos de un canal, con estadísticas. */
async function videosDe(channelId, key, cuantos = 50) {
  const canal = await api("channels", { part: "contentDetails", id: channelId }, key);
  const uploads = canal.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const lista = await api(
    "playlistItems",
    { part: "contentDetails", playlistId: uploads, maxResults: String(cuantos) },
    key,
  );
  const ids = (lista.items ?? []).map((i) => i.contentDetails.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  // `videos.list` acepta 50 ids por llamada.
  const detalle = await api(
    "videos",
    { part: "snippet,statistics,contentDetails", id: ids.slice(0, 50).join(",") },
    key,
  );

  return (detalle.items ?? []).map((v) => {
    const segundos = duracionEnSegundos(v.contentDetails.duration);
    const thumbs = v.snippet.thumbnails ?? {};
    return {
      videoId: v.id,
      videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.snippet.title,
      thumbnail: thumbs.medium?.url ?? thumbs.default?.url ?? null,
      publishedAt: v.snippet.publishedAt,
      durationSeconds: segundos,
      esCorto: segundos !== null && segundos <= 60,
      views: Number(v.statistics.viewCount ?? 0),
      likes: v.statistics.likeCount ? Number(v.statistics.likeCount) : null,
      comments: v.statistics.commentCount ? Number(v.statistics.commentCount) : null,
    };
  });
}

const main = async () => {
  const key = await claveDeEntorno();
  if (!key) {
    console.error("Falta YOUTUBE_API_KEY en .env.local");
    process.exit(1);
  }

  const db = JSON.parse(await fs.readFile(FILE, "utf8"));
  if (db.creators.length === 0) {
    console.error("No hay creadores. Ejecuta antes: node scripts/seed-creadores.mjs");
    process.exit(1);
  }

  const ahora = new Date().toISOString();

  // Empresas: conservamos el id si ya existe una con el mismo nombre.
  const empresasPorKey = {};
  const empresas = EMPRESAS.map((e) => {
    const previa = db.companies.find((c) => c.name === e.name);
    const company = {
      id: previa?.id ?? id("co"),
      name: e.name,
      industry: e.industry,
      website: e.website,
      contactName: e.contactName,
      contactRole: e.contactRole,
      email: e.email,
      phone: e.phone,
      socials: e.socials,
      status: e.status,
      notes: e.notes,
      createdAt: previa?.createdAt ?? ahora,
    };
    empresasPorKey[e.key] = company.id;
    return company;
  });

  // Videos disponibles por canal, para no repetir piezas entre campañas.
  const porHandle = {};
  for (const creador of db.creators) {
    const handle = creador.handle.replace("@", "").toLowerCase();
    porHandle[handle] = { creador, videos: await videosDe(creador.channelId, key) };
    console.log(`${creador.name.padEnd(18)} ${porHandle[handle].videos.length} videos leídos`);
  }

  const campanas = CAMPANAS.map((c) => {
    const deliverables = [];

    for (const pieza of c.piezas) {
      const fuente = porHandle[pieza.canal];
      if (!fuente) {
        console.warn(`  aviso: no hay creador para @${pieza.canal}, pieza omitida`);
        continue;
      }

      // Un short pide un video corto; lo demás, uno largo. Entre los que
      // encajan, se elige el publicado más cerca de la ventana de la campaña,
      // para que las fechas y las vistas acumuladas sean coherentes.
      const quiereCorto = pieza.tipo === "short";
      const inicio = new Date(mesRelativo(c.mesInicio)).getTime();
      const fin = new Date(mesRelativo(c.mesFin ?? c.mesInicio)).getTime();
      const centro = (inicio + fin) / 2;

      const candidatos = fuente.videos
        .map((v, i) => ({ v, i, distancia: Math.abs(new Date(v.publishedAt).getTime() - centro) }))
        .filter(({ v }) => v.esCorto === quiereCorto);

      const elegido = (candidatos.length ? candidatos : fuente.videos.map((v, i) => ({ v, i, distancia: Math.abs(new Date(v.publishedAt).getTime() - centro) })))
        .sort((a, b) => a.distancia - b.distancia)[0];
      if (!elegido) continue;

      const video = elegido.v;
      fuente.videos.splice(elegido.i, 1);

      const tarifa =
        pieza.tipo === "short"
          ? fuente.creador.rateShort
          : pieza.tipo === "integracion"
            ? fuente.creador.rateIntegration
            : fuente.creador.rateVideo;

      deliverables.push({
        id: id("dl"),
        creatorId: fuente.creador.id,
        type: pieza.tipo,
        status: "publicado",
        videoUrl: video.videoUrl,
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        publishedAt: video.publishedAt,
        durationSeconds: video.durationSeconds,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        metricsUpdatedAt: ahora,
        agreedFee: tarifa,
      });
    }

    return {
      id: id("cp"),
      name: c.name,
      companyId: empresasPorKey[c.empresa],
      status: c.status,
      objective: c.objective,
      currency: "USD",
      budget: c.budget,
      startDate: mesRelativo(c.mesInicio),
      endDate: c.mesFin === null ? null : mesRelativo(c.mesFin),
      notes: c.notes,
      deliverables,
      createdAt: ahora,
    };
  });

  db.companies = empresas;
  db.campaigns = campanas;
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");

  console.log("");
  for (const c of campanas) {
    const vistas = c.deliverables.reduce((s, d) => s + (d.views ?? 0), 0);
    console.log(
      `${c.name.padEnd(34)} ${String(c.deliverables.length).padStart(2)} piezas  ` +
        `${vistas.toLocaleString("es").padStart(15)} vistas`,
    );
  }
  console.log(`\n${empresas.length} empresas y ${campanas.length} campañas escritas.`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
