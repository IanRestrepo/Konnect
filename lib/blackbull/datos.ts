import { MARGEN_AGENCIA, clientPriceForRate } from "@/lib/pricing";
import { PLATFORM_LABEL, PLATFORM_METRICS, nombreCanal, piezaLabel, tareaLabel } from "@/lib/socials";
import type { Campaign, Company, Creator } from "@/lib/types";

/**
 * Lo que sale en un media kit, ya calculado y sin nada que no deba salir.
 *
 * El media kit se le manda a clientes, así que aquí se decide qué información
 * del creador es presentable. Fuera quedan las notas internas, los datos
 * bancarios y personales, los contactos del creador —el contacto es la
 * agencia— y cualquier cifra de lo que se le pagó: de las campañas solo salen
 * las marcas y los resultados.
 */
export type MediaKitData = {
  generadoEl: Date;
  conTarifas: boolean;
  moneda: string;
  creador: {
    nombre: string;
    handle: string;
    pais: string;
    categorias: string[];
    plataforma: string;
    avatarUrl: string | null;
  };
  cifras: {
    audienciaTotal: number;
    etiquetaAudiencia: string;
    vistasCanal: number;
    etiquetaVistas: string;
    contenidos: number;
    etiquetaContenido: string;
    vistasParaMarcas: number;
    piezasPublicadas: number;
    /** Interacciones sobre vistas, en %. Null sin piezas con vistas. */
    engagement: number | null;
  };
  canales: { nombre: string; detalle: string; audiencia: number; vistas: number; contenidos: number }[];
  redes: { red: string; handle: string; seguidores: number }[];
  marcas: string[];
  destacadas: {
    titulo: string;
    marca: string;
    pieza: string;
    vistas: number;
    likes: number | null;
    comentarios: number | null;
    fecha: string | null;
    miniaturaUrl: string | null;
  }[];
  tarifas: { red: string; pieza: string; canal: string; precio: number }[];
};

const sinArroba = (h: string) => h.trim().replace(/^@/, "").toLowerCase();

/**
 * Un título de YouTube presentable en papel.
 *
 * Los emojis salen como cajas rotas —la fuente del documento no los tiene— y
 * los hashtags, que en YouTube sirven para que lo encuentren, en un media kit
 * solo son ruido.
 */
function tituloLimpio(titulo: string): string {
  return titulo
    // Emojis y los invisibles que traen pegados: variaciones, uniones y marcas
    // de dirección, que YouTube mete alrededor de las menciones.
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu, "")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * El usuario de una red, aunque se guardara la dirección entera: en un
 * documento impreso «https://www.tiktok.com/@nabrielxd» no se lee, «@nabrielxd»
 * sí.
 */
/**
 * La invitación al servidor, legible: «discord.gg/comunidad». En Discord lo
 * que se vende es la comunidad del creador, no su usuario personal, que a una
 * marca no le dice nada.
 */
function servidorDiscord(handle: string): string {
  const limpio = handle.trim().replace(/\/+$/, "");
  const codigo = limpio.replace(/^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, "");
  if (/^https?:\/\//i.test(codigo)) return codigo.replace(/^https?:\/\/(www\.)?/i, "");
  return `discord.gg/${codigo.replace(/^@/, "")}`;
}

function usuario(handle: string): string {
  const limpio = handle.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(limpio)) return limpio;
  const ultimo = limpio.split("/").pop() ?? limpio;
  return ultimo.startsWith("@") ? ultimo : `@${ultimo}`;
}

export function construirMediaKit(
  creator: Creator,
  campaigns: Campaign[],
  companies: Company[],
  opciones: { conTarifas: boolean; ahora?: Date },
): MediaKitData {
  const metricas = PLATFORM_METRICS[creator.mainPlatform];

  // Su perfil en la red principal suele estar también entre las redes —el alta
  // lo guarda en los dos sitios—, y contarlo dos veces infla la audiencia.
  const redes = creator.socials.filter(
    (s) => !(s.platform === creator.mainPlatform && sinArroba(s.handle) === sinArroba(creator.handle)),
  );

  const audienciaTotal =
    creator.subscribers +
    creator.channels.reduce((s, c) => s + c.subscribers, 0) +
    redes.reduce((s, r) => s + r.followers, 0);

  const empresaPorId = new Map(companies.map((c) => [c.id, c]));

  const publicadas = campaigns.flatMap((campaign) =>
    campaign.deliverables
      .filter((d) => d.creatorId === creator.id && d.status === "publicado")
      .map((d) => ({ d, campaign })),
  );

  const vistasParaMarcas = publicadas.reduce((s, p) => s + (p.d.views ?? 0), 0);
  const interacciones = publicadas.reduce((s, p) => s + (p.d.likes ?? 0) + (p.d.comments ?? 0), 0);

  const marcas = [
    ...new Set(
      publicadas
        .map((p) => empresaPorId.get(p.campaign.companyId)?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const destacadas = [...publicadas]
    .filter((p) => (p.d.views ?? 0) > 0)
    .sort((a, b) => (b.d.views ?? 0) - (a.d.views ?? 0))
    .slice(0, 6)
    .map(({ d, campaign }) => ({
      titulo: tituloLimpio(d.title ?? "") || piezaLabel(d.platform, d.type, d.customType),
      marca: empresaPorId.get(campaign.companyId)?.name ?? "",
      pieza: `${PLATFORM_LABEL[d.platform]} · ${piezaLabel(d.platform, d.type, d.customType)}`,
      vistas: d.views ?? 0,
      likes: d.likes,
      comentarios: d.comments,
      fecha: d.publishedAt,
      miniaturaUrl: d.thumbnail,
    }));

  const canales = [
    {
      nombre: creator.handle || creator.name,
      detalle: `${PLATFORM_LABEL[creator.mainPlatform]} · principal`,
      audiencia: creator.subscribers,
      vistas: creator.totalViews,
      contenidos: creator.videoCount,
    },
    ...creator.channels.map((c) => ({
      nombre: nombreCanal(c),
      detalle: "YouTube · canal adicional",
      audiencia: c.subscribers,
      vistas: c.totalViews,
      contenidos: c.videoCount,
    })),
  ];

  // Lo que ve el cliente es lo que paga, no lo que cobra el creador: la tarifa
  // se convierte con el margen de la agencia, igual que al proponer el precio
  // de una pieza.
  const alCliente = (monto: number) => Math.round(clientPriceForRate(monto, MARGEN_AGENCIA));

  const tarifasPorRed = creator.rates
    .filter((r) => r.amount > 0)
    .map((r) => {
      const canal = r.channelId ? creator.channels.find((c) => c.id === r.channelId) : undefined;
      return {
        red: PLATFORM_LABEL[r.platform],
        pieza: tareaLabel(r.platform, r.type),
        canal: canal ? nombreCanal(canal) : "",
        precio: alCliente(r.amount),
      };
    });

  // Las fichas de antes solo tienen las tres tarifas generales.
  const tarifas =
    tarifasPorRed.length > 0
      ? tarifasPorRed
      : [
          { pieza: "Video dedicado", monto: creator.rateVideo },
          { pieza: "Reel / Short", monto: creator.rateShort },
          { pieza: "Mención dentro de un video", monto: creator.rateIntegration },
        ]
          .filter((t) => t.monto > 0)
          .map((t) => ({
            red: PLATFORM_LABEL[creator.mainPlatform],
            pieza: t.pieza,
            canal: "",
            precio: alCliente(t.monto),
          }));

  return {
    generadoEl: opciones.ahora ?? new Date(),
    conTarifas: opciones.conTarifas,
    moneda: creator.currency,
    creador: {
      nombre: creator.name,
      handle: creator.handle,
      pais: creator.country,
      categorias: creator.categories,
      plataforma: PLATFORM_LABEL[creator.mainPlatform],
      avatarUrl: creator.avatarUrl,
    },
    cifras: {
      audienciaTotal,
      etiquetaAudiencia: metricas.audience,
      vistasCanal: creator.totalViews,
      etiquetaVistas: metricas.views,
      contenidos: creator.videoCount,
      etiquetaContenido: metricas.content,
      vistasParaMarcas,
      piezasPublicadas: publicadas.length,
      engagement: vistasParaMarcas > 0 ? (interacciones / vistasParaMarcas) * 100 : null,
    },
    canales,
    redes: redes.map((r) =>
      r.platform === "discord"
        ? { red: "Servidor de Discord", handle: servidorDiscord(r.handle), seguidores: r.followers }
        : { red: PLATFORM_LABEL[r.platform], handle: usuario(r.handle), seguidores: r.followers },
    ),
    marcas,
    destacadas,
    tarifas,
  };
}
