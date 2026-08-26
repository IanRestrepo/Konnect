import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { codeHint, generateAccessCode, normalizeAccessCode } from "@/lib/portal";
import type {
  Announcement,
  BankingInfo,
  Campaign,
  ChatMessage,
  ChatRoom,
  CollabSession,
  Company,
  Contact,
  Creator,
  CreatorChannel,
  Deliverable,
  PortalRole,
  PublicUser,
  Role,
  SessionItem,
  SessionItemKind,
  SessionStatus,
  SocialLink,
  SocialPlatform,
  User,
} from "@/lib/types";

/**
 * Persistencia sobre Postgres (Neon) con Prisma.
 *
 * Mantiene la misma API que la versión en archivo para no tocar las rutas:
 * devuelve y recibe los tipos de `lib/types.ts`, no las filas de Prisma.
 *
 * Los datos bancarios se guardan cifrados (AES-256-GCM). `read()` solo expone
 * los últimos dígitos; el valor completo se obtiene con `revealBanking()`,
 * que es lo que usa la ruta protegida por código.
 */

export type Settings = {
  /** Clave de YouTube guardada desde Configuración. `YOUTUBE_API_KEY` tiene prioridad. */
  youtubeApiKey?: string;
  /** Módulos apagados por el desarrollador. Pesan más que cualquier permiso. */
  disabledModules?: string[];
};

export type Database = {
  creators: Creator[];
  companies: Company[];
  campaigns: Campaign[];
  users: User[];
  roles: Role[];
  settings: Settings;
};

/** Identificador corto y legible: `cr_l8x2p9`. */
export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------------- Conversión de tipos ---------------- */

const num = (value: Prisma.Decimal | number | bigint | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value);

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : "");
const isoOrNull = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** Fecha para Prisma: descarta cadenas vacías o inválidas en vez de reventar. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const last4 = (value: string) => (value ? value.slice(-4) : "");

/* ---------------- Datos bancarios ---------------- */

/** Cifra un valor; `null` si viene vacío. Sin ENCRYPTION_KEY falla a propósito. */
function seal(value: string | undefined | null): string | null {
  const clean = (value ?? "").trim();
  if (!clean) return null;
  return encrypt(clean);
}

/** Descifra tolerando datos escritos con otra clave: preferimos un hueco a una caída. */
function unseal(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    console.warn("No se pudo descifrar un dato bancario (¿ENCRYPTION_KEY distinta?).");
    return "";
  }
}

type BankingColumns = {
  bankHolder: string | null;
  bankName: string | null;
  bankAccountEnc: string | null;
  bankAccountLast4: string | null;
  bankRoutingEnc: string | null;
  bankRoutingLast4: string | null;
  taxIdEnc: string | null;
  taxIdLast4: string | null;
  paypalEmailEnc: string | null;
  bankNotesEnc: string | null;
};

function bankingToColumns(banking: BankingInfo | undefined): BankingColumns {
  const b = banking ?? {
    holder: "",
    bankName: "",
    accountNumber: "",
    routing: "",
    taxId: "",
  };

  return {
    bankHolder: b.holder || null,
    bankName: b.bankName || null,
    bankAccountEnc: seal(b.accountNumber),
    bankAccountLast4: last4(b.accountNumber ?? "") || null,
    bankRoutingEnc: seal(b.routing),
    bankRoutingLast4: last4(b.routing ?? "") || null,
    taxIdEnc: seal(b.taxId),
    taxIdLast4: last4(b.taxId ?? "") || null,
    paypalEmailEnc: seal(b.paypalEmail),
    bankNotesEnc: seal(b.notes),
  };
}

/** Versión censurada: solo los últimos dígitos, que es lo que pinta la ficha. */
function maskedBanking(row: BankingColumns): BankingInfo {
  return {
    holder: row.bankHolder ?? "",
    bankName: row.bankName ?? "",
    accountNumber: row.bankAccountLast4 ?? "",
    routing: row.bankRoutingLast4 ?? "",
    taxId: row.taxIdLast4 ?? "",
    paypalEmail: row.paypalEmailEnc ? "••••" : "",
    notes: "",
  };
}

function fullBanking(row: BankingColumns): BankingInfo {
  return {
    holder: row.bankHolder ?? "",
    bankName: row.bankName ?? "",
    accountNumber: unseal(row.bankAccountEnc),
    routing: unseal(row.bankRoutingEnc),
    taxId: unseal(row.taxIdEnc),
    paypalEmail: unseal(row.paypalEmailEnc),
    notes: unseal(row.bankNotesEnc),
  };
}

/* ---------------- Mapeo de filas a tipos de la app ---------------- */

const creatorInclude = {
  channels: { orderBy: { createdAt: "asc" } },
  socials: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CreatorInclude;

type CreatorRow = Prisma.CreatorGetPayload<{ include: typeof creatorInclude }>;

function toChannel(row: CreatorRow["channels"][number]): CreatorChannel {
  return {
    id: row.id,
    label: row.label,
    channelId: row.channelId,
    channelUrl: row.channelUrl,
    handle: row.handle,
    avatarUrl: row.avatarUrl,
    subscribers: row.subscribers,
    totalViews: num(row.totalViews),
    videoCount: row.videoCount,
    metricsUpdatedAt: iso(row.metricsUpdatedAt),
  };
}

function toCreator(row: CreatorRow): Creator {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    mainPlatform: row.mainPlatform,
    channelId: row.channelId ?? "",
    channelUrl: row.channelUrl ?? "",
    avatarUrl: row.avatarUrl,
    country: row.country,
    category: row.category,
    status: row.status,
    email: row.email,
    phone: row.phone,
    totalViews: num(row.totalViews),
    subscribers: row.subscribers,
    videoCount: row.videoCount,
    metricsUpdatedAt: iso(row.metricsUpdatedAt),
    currency: row.currency as Creator["currency"],
    rateVideo: num(row.rateVideo),
    rateShort: num(row.rateShort),
    rateIntegration: num(row.rateIntegration),
    paymentMethods: row.paymentMethods,
    banking: maskedBanking(row),
    notes: row.notes,
    channels: row.channels.map(toChannel),
    socials: row.socials.map((s) => ({
      id: s.id,
      platform: s.platform as SocialPlatform,
      handle: s.handle,
      url: s.url,
      avatarUrl: s.avatarUrl,
      followers: s.followers,
      totalViews: num(s.totalViews),
      contentCount: s.contentCount,
      metricsUpdatedAt: isoOrNull(s.metricsUpdatedAt),
    })),
    createdAt: iso(row.createdAt),
  };
}

const companyInclude = {
  contacts: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CompanyInclude;

type CompanyRow = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>;

function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    website: row.website,
    contactName: row.contactName,
    contactRole: row.contactRole,
    email: row.email,
    phone: row.phone,
    contacts: row.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      primary: c.primary,
      notes: c.notes,
    })),
    socials: {
      instagram: row.instagram ?? undefined,
      tiktok: row.tiktok ?? undefined,
      youtube: row.youtube ?? undefined,
      linkedin: row.linkedin ?? undefined,
    },
    status: row.status,
    notes: row.notes,
    createdAt: iso(row.createdAt),
  };
}

const campaignInclude = {
  deliverables: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CampaignInclude;

type CampaignRow = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;

function toDeliverable(row: CampaignRow["deliverables"][number]): Deliverable {
  return {
    id: row.id,
    creatorId: row.creatorId,
    type: row.type,
    status: row.status,
    videoUrl: row.videoUrl,
    videoId: row.videoId,
    title: row.title,
    thumbnail: row.thumbnail,
    publishedAt: isoOrNull(row.publishedAt),
    durationSeconds: row.durationSeconds,
    views: row.views === null ? null : Number(row.views),
    likes: row.likes,
    comments: row.comments,
    metricsUpdatedAt: isoOrNull(row.metricsUpdatedAt),
    agreedFee: num(row.agreedFee),
  };
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    companyId: row.companyId,
    status: row.status,
    objective: row.objective,
    currency: row.currency as Campaign["currency"],
    budget: num(row.budget),
    startDate: iso(row.startDate),
    endDate: isoOrNull(row.endDate),
    notes: row.notes,
    deliverables: row.deliverables.map(toDeliverable),
    createdAt: iso(row.createdAt),
  };
}

type UserRow = Prisma.UserGetPayload<object>;
type RoleRow = Prisma.RoleGetPayload<object>;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarUrl,
    email: row.email,
    passwordHash: row.passwordHash,
    roleId: row.roleId,
    active: row.active,
    lastLoginAt: isoOrNull(row.lastLoginAt),
    createdAt: iso(row.createdAt),
  };
}

function toRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    permissions: row.permissions,
    system: row.system,
    createdAt: iso(row.createdAt),
  };
}

/* ---------------- Roles de arranque ---------------- */

const ROLES_BASE = [
  {
    id: "rol_developer",
    name: "Developer",
    color: "#6d28d9",
    permissions: ["**"],
    system: true,
  },
  {
    id: "rol_admin",
    name: "Administración",
    color: "#0046d9",
    permissions: ["*"],
    system: true,
  },
  {
    id: "rol_equipo",
    name: "Equipo",
    color: "#15794a",
    permissions: [
      "ver_panel",
      "ver_creadores",
      "ver_campanas",
      "ver_empresas",
      "editar_campanas",
    ],
    system: false,
  },
];

/**
 * Los roles del sistema deben existir siempre: sin ellos no se puede crear la
 * primera cuenta. Se siembran una sola vez y no se pisan si ya están.
 */
let rolesListos: Promise<void> | null = null;

function ensureRoles(): Promise<void> {
  rolesListos ??= (async () => {
    await prisma.role.createMany({ data: ROLES_BASE, skipDuplicates: true });
  })().catch((error) => {
    // Que un fallo puntual no deje la promesa cacheada en estado roto.
    rolesListos = null;
    throw error;
  });
  return rolesListos;
}

/* ---------------- Lectura ---------------- */

/**
 * Vuelca la base completa, en el mismo orden que la versión en archivo:
 * lo más nuevo primero en las fichas, y por antigüedad en cuentas y roles.
 */
export async function read(): Promise<Database> {
  await ensureRoles();

  const [creators, companies, campaigns, users, roles, settings] = await Promise.all([
    prisma.creator.findMany({ include: creatorInclude, orderBy: { createdAt: "desc" } }),
    prisma.company.findMany({ include: companyInclude, orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ include: campaignInclude, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ]);

  return {
    creators: creators.map(toCreator),
    companies: companies.map(toCompany),
    campaigns: campaigns.map(toCampaign),
    users: users.map(toUser),
    roles: roles.map(toRole),
    settings: { youtubeApiKey: settings?.youtubeApiKey ?? undefined },
  };
}

/* ---------------- Creadores ---------------- */

export async function createCreator(input: Omit<Creator, "id" | "createdAt">): Promise<Creator> {
  const row = await prisma.creator.create({
    data: {
      id: newId("cr"),
      name: input.name,
      handle: input.handle,
      mainPlatform: input.mainPlatform ?? "youtube",
      channelId: input.channelId || null,
      channelUrl: input.channelUrl || null,
      avatarUrl: input.avatarUrl,
      country: input.country ?? "",
      category: input.category,
      status: input.status,
      email: input.email ?? "",
      phone: input.phone ?? "",
      subscribers: input.subscribers ?? 0,
      totalViews: BigInt(Math.trunc(input.totalViews ?? 0)),
      videoCount: input.videoCount ?? 0,
      metricsUpdatedAt: toDate(input.metricsUpdatedAt),
      currency: input.currency,
      rateVideo: input.rateVideo ?? 0,
      rateShort: input.rateShort ?? 0,
      rateIntegration: input.rateIntegration ?? 0,
      paymentMethods: input.paymentMethods ?? [],
      ...bankingToColumns(input.banking),
      notes: input.notes ?? "",
      channels: {
        create: (input.channels ?? []).map((c) => ({
          id: c.id || newId("ch"),
          label: c.label,
          channelId: c.channelId,
          channelUrl: c.channelUrl,
          handle: c.handle,
          avatarUrl: c.avatarUrl,
          subscribers: c.subscribers ?? 0,
          totalViews: BigInt(Math.trunc(c.totalViews ?? 0)),
          videoCount: c.videoCount ?? 0,
          metricsUpdatedAt: toDate(c.metricsUpdatedAt),
        })),
      },
      socials: {
        create: (input.socials ?? []).map((s) => ({
          id: s.id || newId("sl"),
          platform: s.platform,
          handle: s.handle,
          url: s.url,
          avatarUrl: s.avatarUrl ?? null,
          followers: s.followers ?? 0,
          totalViews: BigInt(Math.trunc(s.totalViews ?? 0)),
          contentCount: s.contentCount ?? 0,
          metricsUpdatedAt: toDate(s.metricsUpdatedAt),
        })),
      },
    },
    include: creatorInclude,
  });

  return toCreator(row);
}

export async function updateCreator(id: string, patch: Partial<Creator>): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: Prisma.CreatorUpdateInput = {};

  if (patch.name !== undefined) data.name = patch.name;
  if (patch.handle !== undefined) data.handle = patch.handle;
  if (patch.mainPlatform !== undefined) data.mainPlatform = patch.mainPlatform;
  if (patch.channelId !== undefined) data.channelId = patch.channelId || null;
  if (patch.channelUrl !== undefined) data.channelUrl = patch.channelUrl || null;
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
  if (patch.country !== undefined) data.country = patch.country;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.email !== undefined) data.email = patch.email;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.subscribers !== undefined) data.subscribers = patch.subscribers;
  if (patch.totalViews !== undefined) data.totalViews = BigInt(Math.trunc(patch.totalViews));
  if (patch.videoCount !== undefined) data.videoCount = patch.videoCount;
  if (patch.metricsUpdatedAt !== undefined) data.metricsUpdatedAt = toDate(patch.metricsUpdatedAt);
  if (patch.currency !== undefined) data.currency = patch.currency;
  if (patch.rateVideo !== undefined) data.rateVideo = patch.rateVideo;
  if (patch.rateShort !== undefined) data.rateShort = patch.rateShort;
  if (patch.rateIntegration !== undefined) data.rateIntegration = patch.rateIntegration;
  if (patch.paymentMethods !== undefined) data.paymentMethods = patch.paymentMethods;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.banking !== undefined) Object.assign(data, bankingToColumns(patch.banking));

  const row = await prisma.creator.update({ where: { id }, data, include: creatorInclude });

  // Las listas anidadas se reemplazan enteras, como hacía la versión en archivo.
  if (patch.channels !== undefined || patch.socials !== undefined) {
    return (await replaceCreatorLists(id, patch)) ?? toCreator(row);
  }
  return toCreator(row);
}

async function replaceCreatorLists(id: string, patch: Partial<Creator>): Promise<Creator | null> {
  await prisma.$transaction(async (tx) => {
    if (patch.channels !== undefined) {
      await tx.creatorChannel.deleteMany({ where: { creatorId: id } });
      for (const c of patch.channels) {
        await tx.creatorChannel.create({
          data: {
            id: c.id || newId("ch"),
            creatorId: id,
            label: c.label,
            channelId: c.channelId,
            channelUrl: c.channelUrl,
            handle: c.handle,
            avatarUrl: c.avatarUrl,
            subscribers: c.subscribers ?? 0,
            totalViews: BigInt(Math.trunc(c.totalViews ?? 0)),
            videoCount: c.videoCount ?? 0,
            metricsUpdatedAt: toDate(c.metricsUpdatedAt),
          },
        });
      }
    }
    if (patch.socials !== undefined) {
      await tx.socialLink.deleteMany({ where: { creatorId: id } });
      for (const s of patch.socials) {
        await tx.socialLink.create({
          data: {
            id: s.id || newId("sl"),
            creatorId: id,
            platform: s.platform,
            handle: s.handle,
            url: s.url,
            avatarUrl: s.avatarUrl ?? null,
            followers: s.followers ?? 0,
            totalViews: BigInt(Math.trunc(s.totalViews ?? 0)),
            contentCount: s.contentCount ?? 0,
            metricsUpdatedAt: toDate(s.metricsUpdatedAt),
          },
        });
      }
    }
  });

  const row = await prisma.creator.findUnique({ where: { id }, include: creatorInclude });
  return row ? toCreator(row) : null;
}

/** Datos bancarios completos. Solo para la ruta que exige el código de acceso. */
export async function revealBanking(creatorId: string): Promise<BankingInfo | null> {
  const row = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: {
      bankHolder: true,
      bankName: true,
      bankAccountEnc: true,
      bankAccountLast4: true,
      bankRoutingEnc: true,
      bankRoutingLast4: true,
      taxIdEnc: true,
      taxIdLast4: true,
      paypalEmailEnc: true,
      bankNotesEnc: true,
    },
  });
  return row ? fullBanking(row) : null;
}

/** Añade un canal adicional al creador, sin duplicar por `channelId`. */
export async function addCreatorChannel(
  creatorId: string,
  channel: Omit<CreatorChannel, "id">,
): Promise<{ creator: Creator } | { error: string }> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: creatorInclude,
  });
  if (!creator) return { error: "Creador no encontrado." };

  if (creator.channelId === channel.channelId) {
    return { error: "Ese ya es el canal principal del creador." };
  }
  if (creator.channels.some((c) => c.channelId === channel.channelId)) {
    return { error: "Ese canal ya está en la ficha." };
  }

  await prisma.creatorChannel.create({
    data: {
      id: newId("ch"),
      creatorId,
      label: channel.label,
      channelId: channel.channelId,
      channelUrl: channel.channelUrl,
      handle: channel.handle,
      avatarUrl: channel.avatarUrl,
      subscribers: channel.subscribers ?? 0,
      totalViews: BigInt(Math.trunc(channel.totalViews ?? 0)),
      videoCount: channel.videoCount ?? 0,
      metricsUpdatedAt: toDate(channel.metricsUpdatedAt),
    },
  });

  const actualizado = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: creatorInclude,
  });
  return { creator: toCreator(actualizado!) };
}

export async function removeCreatorChannel(
  creatorId: string,
  channelId: string,
): Promise<boolean> {
  const { count } = await prisma.creatorChannel.deleteMany({
    where: { creatorId, id: channelId },
  });
  return count > 0;
}

export async function setCreatorSocials(
  creatorId: string,
  socials: SocialLink[],
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;
  return replaceCreatorLists(creatorId, { socials });
}

/* ---------------- Empresas ---------------- */

export async function createCompany(input: Omit<Company, "id" | "createdAt">): Promise<Company> {
  const row = await prisma.company.create({
    data: {
      id: newId("co"),
      name: input.name,
      industry: input.industry,
      website: input.website,
      contactName: input.contactName ?? "",
      contactRole: input.contactRole ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      instagram: input.socials?.instagram ?? null,
      tiktok: input.socials?.tiktok ?? null,
      youtube: input.socials?.youtube ?? null,
      linkedin: input.socials?.linkedin ?? null,
      status: input.status,
      notes: input.notes ?? "",
      contacts: {
        create: (input.contacts ?? []).map((c) => ({
          id: c.id || newId("ct"),
          name: c.name,
          role: c.role ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          primary: c.primary ?? false,
          notes: c.notes ?? "",
        })),
      },
    },
    include: companyInclude,
  });

  return toCompany(row);
}

export async function updateCompany(id: string, patch: Partial<Company>): Promise<Company | null> {
  const actual = await prisma.company.findUnique({ where: { id }, include: companyInclude });
  if (!actual) return null;

  const data: Prisma.CompanyUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.industry !== undefined) data.industry = patch.industry;
  if (patch.website !== undefined) data.website = patch.website;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.contactName !== undefined) data.contactName = patch.contactName;
  if (patch.contactRole !== undefined) data.contactRole = patch.contactRole;
  if (patch.email !== undefined) data.email = patch.email;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.socials !== undefined) {
    data.instagram = patch.socials.instagram ?? null;
    data.tiktok = patch.socials.tiktok ?? null;
    data.youtube = patch.socials.youtube ?? null;
    data.linkedin = patch.socials.linkedin ?? null;
  }

  const contacts: Contact[] | undefined = patch.contacts;

  // El atajo del contacto principal se mantiene sincronizado con la lista.
  const lista = contacts ?? actual.contacts;
  const principal = lista.find((c) => c.primary) ?? lista[0];
  if (principal) {
    data.contactName = principal.name;
    data.contactRole = principal.role;
    data.email = principal.email;
    data.phone = principal.phone;
  }

  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id }, data });
    if (contacts !== undefined) {
      await tx.contact.deleteMany({ where: { companyId: id } });
      for (const c of contacts) {
        await tx.contact.create({
          data: {
            id: c.id || newId("ct"),
            companyId: id,
            name: c.name,
            role: c.role ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
            primary: c.primary ?? false,
            notes: c.notes ?? "",
          },
        });
      }
    }
  });

  const row = await prisma.company.findUnique({ where: { id }, include: companyInclude });
  return row ? toCompany(row) : null;
}

/* ---------------- Campañas ---------------- */

function deliverableData(input: Omit<Deliverable, "id">) {
  return {
    creatorId: input.creatorId,
    type: input.type,
    status: input.status,
    agreedFee: input.agreedFee ?? 0,
    videoId: input.videoId,
    videoUrl: input.videoUrl,
    title: input.title,
    thumbnail: input.thumbnail,
    publishedAt: toDate(input.publishedAt),
    durationSeconds: input.durationSeconds,
    views: input.views === null || input.views === undefined ? null : BigInt(Math.trunc(input.views)),
    likes: input.likes,
    comments: input.comments,
    metricsUpdatedAt: toDate(input.metricsUpdatedAt),
  };
}

export async function createCampaign(
  input: Omit<Campaign, "id" | "createdAt" | "deliverables"> & { deliverables?: Deliverable[] },
): Promise<Campaign> {
  const startDate = toDate(input.startDate) ?? new Date();

  const row = await prisma.campaign.create({
    data: {
      id: newId("cp"),
      name: input.name,
      companyId: input.companyId,
      status: input.status,
      objective: input.objective,
      currency: input.currency,
      budget: input.budget ?? 0,
      startDate,
      endDate: toDate(input.endDate),
      notes: input.notes ?? "",
      deliverables: {
        create: (input.deliverables ?? []).map((d) => ({
          id: d.id || newId("dl"),
          ...deliverableData(d),
        })),
      },
    },
    include: campaignInclude,
  });

  return toCampaign(row);
}

export async function updateCampaign(
  id: string,
  patch: Partial<Campaign>,
): Promise<Campaign | null> {
  const existe = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: Prisma.CampaignUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.objective !== undefined) data.objective = patch.objective;
  if (patch.currency !== undefined) data.currency = patch.currency;
  if (patch.budget !== undefined) data.budget = patch.budget;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.startDate !== undefined) {
    const fecha = toDate(patch.startDate);
    if (fecha) data.startDate = fecha;
  }
  if (patch.endDate !== undefined) data.endDate = toDate(patch.endDate);

  await prisma.campaign.update({ where: { id }, data });

  if (patch.deliverables !== undefined) {
    await prisma.$transaction(async (tx) => {
      await tx.deliverable.deleteMany({ where: { campaignId: id } });
      for (const d of patch.deliverables!) {
        await tx.deliverable.create({
          data: { id: d.id || newId("dl"), campaignId: id, ...deliverableData(d) },
        });
      }
    });
  }

  const row = await prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
  return row ? toCampaign(row) : null;
}

export async function addDeliverable(
  campaignId: string,
  input: Omit<Deliverable, "id">,
): Promise<Deliverable | null> {
  const campana = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campana) return null;

  const row = await prisma.deliverable.create({
    data: { id: newId("dl"), campaignId, ...deliverableData(input) },
  });

  return toDeliverable(row);
}

/* ---------------- Ajustes ---------------- */

export async function getSettings(): Promise<Settings> {
  const row = await prisma.settings.findUnique({ where: { id: "default" } });
  return {
    youtubeApiKey: row?.youtubeApiKey ?? undefined,
    disabledModules: row?.disabledModules ?? [],
  };
}

/** Solo los módulos apagados. Se consulta en cada página protegida. */
export async function getDisabledModules(): Promise<string[]> {
  const row = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { disabledModules: true },
  });
  return row?.disabledModules ?? [];
}

export async function setDisabledModules(keys: string[]): Promise<string[]> {
  const row = await prisma.settings.upsert({
    where: { id: "default" },
    update: { disabledModules: keys },
    create: { id: "default", disabledModules: keys },
  });
  return row.disabledModules;
}

export async function saveSettings(patch: Settings): Promise<Settings> {
  const row = await prisma.settings.upsert({
    where: { id: "default" },
    update: { youtubeApiKey: patch.youtubeApiKey ?? null },
    create: { id: "default", youtubeApiKey: patch.youtubeApiKey ?? null },
  });
  return {
    youtubeApiKey: row.youtubeApiKey ?? undefined,
    disabledModules: row.disabledModules,
  };
}

/** Deja la base como recién sembrada. Útil al probar. */
export async function resetDatabase(): Promise<Database> {
  await prisma.$transaction([
    prisma.metricSnapshot.deleteMany(),
    prisma.sensitiveAccessLog.deleteMany(),
    prisma.deliverable.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.company.deleteMany(),
    prisma.creatorChannel.deleteMany(),
    prisma.socialLink.deleteMany(),
    prisma.creator.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
    prisma.settings.deleteMany(),
  ]);

  rolesListos = null;
  await ensureRoles();
  return read();
}

/* ---------------- Usuarios y roles ---------------- */

export async function listUsers(): Promise<User[]> {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toUser);
}

export async function listRoles(): Promise<Role[]> {
  await ensureRoles();
  const rows = await prisma.role.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toRole);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return row ? toUser(row) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toUser(row) : null;
}

export async function createUser(
  input: Omit<User, "id" | "createdAt" | "lastLoginAt" | "avatarUrl"> & { avatarUrl?: string | null },
): Promise<User | { error: string }> {
  await ensureRoles();

  const email = input.email.trim().toLowerCase();

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "Ya existe una cuenta con ese correo." };
  }
  if (!(await prisma.role.findUnique({ where: { id: input.roleId }, select: { id: true } }))) {
    return { error: "El rol indicado no existe." };
  }

  try {
    const row = await prisma.user.create({
      data: {
        id: newId("us"),
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        email,
        passwordHash: input.passwordHash,
        roleId: input.roleId,
        active: input.active ?? true,
      },
    });
    return toUser(row);
  } catch (error) {
    // Dos altas simultáneas con el mismo correo: gana la primera.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    throw error;
  }
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  const existe = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: Prisma.UserUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl || null;
  if (patch.email !== undefined) data.email = patch.email.trim().toLowerCase();
  if (patch.passwordHash !== undefined) data.passwordHash = patch.passwordHash;
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.lastLoginAt !== undefined) data.lastLoginAt = toDate(patch.lastLoginAt);
  if (patch.roleId !== undefined) data.role = { connect: { id: patch.roleId } };

  const row = await prisma.user.update({ where: { id }, data });
  return toUser(row);
}

export async function deleteUser(id: string): Promise<boolean> {
  const { count } = await prisma.user.deleteMany({ where: { id } });
  return count > 0;
}

export async function createRole(input: Omit<Role, "id" | "createdAt">): Promise<Role> {
  const row = await prisma.role.create({
    data: {
      id: newId("rol"),
      name: input.name,
      color: input.color,
      permissions: input.permissions,
      system: input.system ?? false,
    },
  });
  return toRole(row);
}

export async function updateRole(id: string, patch: Partial<Role>): Promise<Role | null> {
  const actual = await prisma.role.findUnique({ where: { id } });
  if (!actual) return null;

  const data: Prisma.RoleUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.color !== undefined) data.color = patch.color;

  // Un rol del sistema conserva su naturaleza y sus permisos completos.
  if (actual.system) {
    data.system = true;
  } else {
    if (patch.permissions !== undefined) data.permissions = patch.permissions;
    if (patch.system !== undefined) data.system = patch.system;
  }

  const row = await prisma.role.update({ where: { id }, data });
  return toRole(row);
}

export async function deleteRole(id: string): Promise<{ ok: boolean; error?: string }> {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return { ok: false, error: "El rol no existe." };
  if (role.system) return { ok: false, error: "Los roles del sistema no se pueden eliminar." };

  const enUso = await prisma.user.count({ where: { roleId: id } });
  if (enUso > 0) {
    return { ok: false, error: "Hay usuarios con ese rol. Reasígnalos antes de eliminarlo." };
  }

  await prisma.role.delete({ where: { id } });
  return { ok: true };
}

/** Versión sin credenciales: lo único que puede salir hacia el cliente. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    email: user.email,
    roleId: user.roleId,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/* ---------------- Sesiones de entrega ---------------- */

const sessionInclude = {
  accesses: { orderBy: { createdAt: "asc" } },
  items: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.CollabSessionInclude;

type SessionRow = Prisma.CollabSessionGetPayload<{ include: typeof sessionInclude }>;

function toSession(row: SessionRow): CollabSession {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    notes: row.notes,
    campaignId: row.campaignId,
    creatorId: row.creatorId,
    showMetrics: row.showMetrics,
    accesses: row.accesses.map((a) => ({
      id: a.id,
      role: a.role,
      label: a.label,
      code: unseal(a.codeEnc),
      codeHint: a.codeHint,
      canUpload: a.canUpload,
      revoked: a.revoked,
      lastSeenAt: isoOrNull(a.lastSeenAt),
      createdAt: iso(a.createdAt),
    })),
    items: row.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      url: i.url,
      notes: i.notes,
      authorRole: i.authorRole,
      authorLabel: i.authorLabel,
      createdAt: iso(i.createdAt),
    })),
    createdAt: iso(row.createdAt),
  };
}

export async function listSessions(): Promise<CollabSession[]> {
  const rows = await prisma.collabSession.findMany({
    include: sessionInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSession);
}

export async function getCollabSession(id: string): Promise<CollabSession | null> {
  const row = await prisma.collabSession.findUnique({ where: { id }, include: sessionInclude });
  return row ? toSession(row) : null;
}

export async function createCollabSession(input: {
  name: string;
  campaignId?: string | null;
  creatorId?: string | null;
  notes?: string;
  showMetrics?: boolean;
  accesses: { role: PortalRole; label: string; canUpload?: boolean }[];
}): Promise<CollabSession> {
  const row = await prisma.collabSession.create({
    data: {
      id: newId("se"),
      name: input.name,
      campaignId: input.campaignId || null,
      creatorId: input.creatorId || null,
      notes: input.notes ?? "",
      showMetrics: input.showMetrics ?? true,
      accesses: {
        create: input.accesses.map((a) => {
          const code = generateAccessCode();
          return {
            id: newId("ac"),
            role: a.role,
            label: a.label,
            codeEnc: encrypt(code),
            codeHint: codeHint(code),
            canUpload: a.canUpload ?? true,
          };
        }),
      },
    },
    include: sessionInclude,
  });

  return toSession(row);
}

export async function updateCollabSession(
  id: string,
  patch: { name?: string; status?: SessionStatus; notes?: string; showMetrics?: boolean },
): Promise<CollabSession | null> {
  const existe = await prisma.collabSession.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  await prisma.collabSession.update({ where: { id }, data: patch });
  return getCollabSession(id);
}

export async function deleteCollabSession(id: string): Promise<boolean> {
  const { count } = await prisma.collabSession.deleteMany({ where: { id } });
  return count > 0;
}

export async function addSessionAccess(
  sessionId: string,
  input: { role: PortalRole; label: string; canUpload?: boolean },
): Promise<CollabSession | null> {
  const existe = await prisma.collabSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!existe) return null;

  const code = generateAccessCode();
  await prisma.sessionAccess.create({
    data: {
      id: newId("ac"),
      sessionId,
      role: input.role,
      label: input.label,
      codeEnc: encrypt(code),
      codeHint: codeHint(code),
      canUpload: input.canUpload ?? true,
    },
  });

  return getCollabSession(sessionId);
}

/** Revoca o reactiva un acceso sin borrarlo, para no perder el rastro. */
export async function setAccessRevoked(
  accessId: string,
  revoked: boolean,
): Promise<CollabSession | null> {
  const access = await prisma.sessionAccess.findUnique({
    where: { id: accessId },
    select: { sessionId: true },
  });
  if (!access) return null;

  await prisma.sessionAccess.update({ where: { id: accessId }, data: { revoked } });
  return getCollabSession(access.sessionId);
}

/** Cambia el código y deja fuera a quien tuviera el anterior. */
export async function regenerateAccessCode(accessId: string): Promise<CollabSession | null> {
  const access = await prisma.sessionAccess.findUnique({
    where: { id: accessId },
    select: { sessionId: true },
  });
  if (!access) return null;

  const code = generateAccessCode();
  await prisma.sessionAccess.update({
    where: { id: accessId },
    data: { codeEnc: encrypt(code), codeHint: codeHint(code), revoked: false, lastSeenAt: null },
  });

  return getCollabSession(access.sessionId);
}

export async function addSessionItem(
  sessionId: string,
  input: {
    kind: SessionItemKind;
    title: string;
    url?: string | null;
    notes?: string;
    authorRole: PortalRole | null;
    authorLabel: string;
  },
): Promise<SessionItem | null> {
  const existe = await prisma.collabSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });
  if (!existe || existe.status === "cerrada") return null;

  const row = await prisma.sessionItem.create({
    data: {
      id: newId("it"),
      sessionId,
      kind: input.kind,
      title: input.title,
      url: input.url || null,
      notes: input.notes ?? "",
      authorRole: input.authorRole,
      authorLabel: input.authorLabel,
    },
  });

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    url: row.url,
    notes: row.notes,
    authorRole: row.authorRole,
    authorLabel: row.authorLabel,
    createdAt: iso(row.createdAt),
  };
}

export async function removeSessionItem(sessionId: string, itemId: string): Promise<boolean> {
  const { count } = await prisma.sessionItem.deleteMany({ where: { id: itemId, sessionId } });
  return count > 0;
}

/**
 * Comprueba un código contra los accesos vivos de la sesión. Recorre todos los
 * accesos aunque encuentre el bueno, para no delatar por tiempo cuál acertó.
 */
export async function verifyPortalCode(
  sessionId: string,
  code: string,
): Promise<{ id: string; role: PortalRole; label: string; canUpload: boolean } | null> {
  const session = await prisma.collabSession.findUnique({
    where: { id: sessionId },
    include: { accesses: { where: { revoked: false } } },
  });
  if (!session || session.status === "cerrada") return null;

  const buscado = normalizeAccessCode(code);
  if (!buscado) return null;

  let encontrado: (typeof session.accesses)[number] | null = null;
  for (const acceso of session.accesses) {
    if (normalizeAccessCode(unseal(acceso.codeEnc)) === buscado) encontrado = acceso;
  }
  if (!encontrado) return null;

  await prisma.sessionAccess.update({
    where: { id: encontrado.id },
    data: { lastSeenAt: new Date() },
  });

  return {
    id: encontrado.id,
    role: encontrado.role,
    label: encontrado.label,
    canUpload: encontrado.canUpload,
  };
}

/* ---------------- Chat interno ---------------- */

type ChatRoomRow = Prisma.ChatRoomGetPayload<object> & {
  messages?: { createdAt: Date }[];
  _count?: { messages: number };
};

function toRoom(row: ChatRoomRow): ChatRoom {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    archived: row.archived,
    roleIds: row.roleIds,
    memberIds: row.memberIds,
    createdAt: iso(row.createdAt),
    lastMessageAt: isoOrNull(row.messages?.[0]?.createdAt ?? null),
    messageCount: row._count?.messages ?? 0,
  };
}

/**
 * Quién entra a una sala.
 *
 * · Privada (con miembros): solo ellos. Ni administración ni el desarrollador,
 *   porque una conversación privada que lee un tercero no es privada.
 * · Por roles: esos roles, y administración, que si no podría crear una sala
 *   y quedarse fuera de ella.
 * · Sin nada: el equipo entero.
 */
export function canSeeRoom(
  room: ChatRoom,
  roleId: string,
  permissions: readonly string[],
  userId?: string,
): boolean {
  if (room.memberIds.length) return Boolean(userId && room.memberIds.includes(userId));
  if (!room.roleIds.length) return true;
  if (permissions.includes("*") || permissions.includes("**")) return true;
  return room.roleIds.includes(roleId);
}

export async function listRooms(): Promise<ChatRoom[]> {
  const rows = await prisma.chatRoom.findMany({
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRoom);
}

export async function getRoom(id: string): Promise<ChatRoom | null> {
  const row = await prisma.chatRoom.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      _count: { select: { messages: true } },
    },
  });
  return row ? toRoom(row) : null;
}

export async function createRoom(input: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  roleIds?: string[];
  memberIds?: string[];
}): Promise<ChatRoom> {
  const row = await prisma.chatRoom.create({
    data: {
      id: newId("sa"),
      name: input.name,
      description: input.description ?? "",
      color: input.color ?? "#0046d9",
      icon: input.icon ?? "hash",
      roleIds: input.roleIds ?? [],
      memberIds: input.memberIds ?? [],
    },
  });
  return toRoom(row);
}

export async function updateRoom(
  id: string,
  patch: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    archived?: boolean;
    roleIds?: string[];
    memberIds?: string[];
  },
): Promise<ChatRoom | null> {
  const existe = await prisma.chatRoom.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  await prisma.chatRoom.update({ where: { id }, data: patch });
  return getRoom(id);
}

export async function deleteRoom(id: string): Promise<boolean> {
  const { count } = await prisma.chatRoom.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * Mensajes de una sala. `after` trae solo lo nuevo, que es lo que consulta el
 * sondeo del navegador: así cada comprobación es una lectura mínima por índice.
 */
export async function listMessages(
  roomId: string,
  options: { after?: string; limit?: number } = {},
): Promise<ChatMessage[]> {
  const desde = toDate(options.after);

  const rows = await prisma.chatMessage.findMany({
    where: { roomId, ...(desde ? { createdAt: { gt: desde } } : {}) },
    orderBy: { createdAt: desde ? "asc" : "desc" },
    take: options.limit ?? 60,
  });

  // Sin cursor se piden los últimos, así que hay que devolverlos en orden.
  const ordenados = desde ? rows : rows.reverse();

  return ordenados.map((m) => ({
    id: m.id,
    roomId: m.roomId,
    authorId: m.authorId,
    authorName: m.authorName,
    body: m.body,
    editedAt: isoOrNull(m.editedAt),
    createdAt: iso(m.createdAt),
  }));
}

export async function sendMessage(
  roomId: string,
  input: { authorId: string; authorName: string; body: string },
): Promise<ChatMessage | null> {
  const sala = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, archived: true },
  });
  if (!sala || sala.archived) return null;

  const row = await prisma.chatMessage.create({
    data: {
      id: newId("ms"),
      roomId,
      authorId: input.authorId,
      authorName: input.authorName,
      body: input.body,
    },
  });

  return {
    id: row.id,
    roomId: row.roomId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    editedAt: isoOrNull(row.editedAt),
    createdAt: iso(row.createdAt),
  };
}

/** Borra un mensaje. Sin permiso de gestión, solo los propios. */
export async function deleteMessage(
  roomId: string,
  messageId: string,
  options: { onlyAuthorId?: string } = {},
): Promise<boolean> {
  const { count } = await prisma.chatMessage.deleteMany({
    where: {
      id: messageId,
      roomId,
      ...(options.onlyAuthorId ? { authorId: options.onlyAuthorId } : {}),
    },
  });
  return count > 0;
}

/** Edita un mensaje. Sin permiso de gestión, solo los propios. */
export async function editMessage(
  roomId: string,
  messageId: string,
  body: string,
  options: { onlyAuthorId?: string } = {},
): Promise<ChatMessage | null> {
  const { count } = await prisma.chatMessage.updateMany({
    where: {
      id: messageId,
      roomId,
      ...(options.onlyAuthorId ? { authorId: options.onlyAuthorId } : {}),
    },
    data: { body, editedAt: new Date() },
  });
  if (!count) return null;

  const row = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!row) return null;

  return {
    id: row.id,
    roomId: row.roomId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    editedAt: isoOrNull(row.editedAt),
    createdAt: iso(row.createdAt),
  };
}

/* ---------------- Avisos del desarrollador ---------------- */

function toAnnouncement(row: Prisma.AnnouncementGetPayload<object>): Announcement {
  return {
    id: row.id,
    message: row.message,
    tone: row.tone,
    active: row.active,
    roleIds: row.roleIds,
    dismissible: row.dismissible,
    createdAt: iso(row.createdAt),
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const rows = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toAnnouncement);
}

/** Los que le tocan a un rol concreto. Vacío en `roleIds` = para todos. */
export async function activeAnnouncementsFor(roleId: string): Promise<Announcement[]> {
  const rows = await prisma.announcement.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map(toAnnouncement)
    .filter((a) => !a.roleIds.length || a.roleIds.includes(roleId));
}

export async function createAnnouncement(input: {
  message: string;
  tone?: Announcement["tone"];
  roleIds?: string[];
  dismissible?: boolean;
}): Promise<Announcement> {
  const row = await prisma.announcement.create({
    data: {
      id: newId("av"),
      message: input.message,
      tone: input.tone ?? "info",
      roleIds: input.roleIds ?? [],
      dismissible: input.dismissible ?? true,
    },
  });
  return toAnnouncement(row);
}

export async function updateAnnouncement(
  id: string,
  patch: {
    message?: string;
    tone?: Announcement["tone"];
    active?: boolean;
    roleIds?: string[];
    dismissible?: boolean;
  },
): Promise<Announcement | null> {
  const existe = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;
  const row = await prisma.announcement.update({ where: { id }, data: patch });
  return toAnnouncement(row);
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const { count } = await prisma.announcement.deleteMany({ where: { id } });
  return count > 0;
}
