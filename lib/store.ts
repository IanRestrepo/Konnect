import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { codeHint, generateAccessCode, normalizeAccessCode } from "@/lib/portal";
import { CATEGORIAS_INICIALES } from "@/lib/labels";
import type {
  Announcement,
  BankingAccount,
  BankingInfo,
  Campaign,
  CollabSession,
  Company,
  Contact,
  ContactField,
  Creator,
  CreatorApiConnection,
  CreatorChannel,
  CreatorRate,
  Deliverable,
  Doc,
  DocLink,
  DocSummary,
  Folder,
  PortalRole,
  PublicUser,
  Role,
  SessionItem,
  SessionEventKind,
  SessionItemKind,
  SessionRequirement,
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

type BankAccountColumns = {
  id: string;
  method: BankingAccount["method"];
  label: string;
  holder: string;
  bankName: string;
  referenceEnc: string | null;
  referenceLast4: string | null;
  routingEnc: string | null;
  routingLast4: string | null;
  notesEnc: string | null;
};

/** Cuenta de cobro censurada: lo justo para reconocerla en la lista. */
function maskedAccount(row: BankAccountColumns): BankingAccount {
  return {
    id: row.id,
    method: row.method,
    label: row.label,
    holder: row.holder,
    bankName: row.bankName,
    reference: row.referenceLast4 ?? "",
    routing: row.routingLast4 ?? "",
    notes: "",
  };
}

function fullAccount(row: BankAccountColumns): BankingAccount {
  return {
    id: row.id,
    method: row.method,
    label: row.label,
    holder: row.holder,
    bankName: row.bankName,
    reference: unseal(row.referenceEnc),
    routing: unseal(row.routingEnc),
    notes: unseal(row.notesEnc),
  };
}

/** Columnas de una cuenta de cobro, con lo sensible ya cifrado. */
function accountToColumns(account: BankingAccount, creatorId: string, position: number) {
  return {
    id: account.id || newId("ba"),
    creatorId,
    method: account.method,
    label: account.label ?? "",
    holder: account.holder ?? "",
    bankName: account.bankName ?? "",
    referenceEnc: seal(account.reference),
    referenceLast4: last4(account.reference ?? "") || null,
    routingEnc: seal(account.routing),
    routingLast4: last4(account.routing ?? "") || null,
    notesEnc: seal(account.notes),
    position,
  };
}

/* ---------------- Mapeo de filas a tipos de la app ---------------- */

const creatorInclude = {
  channels: { orderBy: { createdAt: "asc" } },
  socials: { orderBy: { createdAt: "asc" } },
  rates: { orderBy: [{ platform: "asc" }, { type: "asc" }] },
  contacts: { orderBy: [{ primary: "desc" }, { createdAt: "asc" }] },
  contactFields: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  bankAccounts: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
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

function toCreator(row: CreatorRow, apiConnections: CreatorApiConnection[] = []): Creator {
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
    rates: row.rates.map((r) => ({
      id: r.id,
      platform: r.platform as SocialPlatform,
      type: r.type,
      amount: num(r.amount),
      channelId: r.channelId,
    })),
    contacts: row.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      primary: c.primary,
      notes: c.notes,
    })),
    contactFields: row.contactFields.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
    })),
    paymentMethods: row.paymentMethods,
    banking: maskedBanking(row),
    bankAccounts: row.bankAccounts.map(maskedAccount),
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
    apiConnections,
    createdAt: iso(row.createdAt),
  };
}

/** `P2021`: la tabla aún no existe (falta `prisma db push`). No es fatal. */
function isMissingTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

/**
 * Conexiones de API de todos los creadores, agrupadas por creador. Si la tabla
 * todavía no existe devuelve un mapa vacío en vez de tumbar la lectura entera.
 */
async function readApiConnections(): Promise<Map<string, CreatorApiConnection[]>> {
  const porCreador = new Map<string, CreatorApiConnection[]>();
  try {
    const rows = await prisma.creatorApiConnection.findMany({
      orderBy: { createdAt: "asc" },
    });
    for (const c of rows) {
      const lista = porCreador.get(c.creatorId) ?? [];
      lista.push({
        platform: c.platform as SocialPlatform,
        hint: c.secretLast4,
        externalId: c.externalId,
        status: c.status,
        connectedAt: iso(c.connectedAt),
      });
      porCreador.set(c.creatorId, lista);
    }
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn("CreatorApiConnection no existe todavía: ejecuta `npx prisma db push`.");
  }
  return porCreador;
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
    platform: row.platform as SocialPlatform,
    channelId: row.channelId,
    clientPrice: num(row.clientPrice),
    commissionPct: row.commissionPct === null ? null : num(row.commissionPct),
    commissionFixed: row.commissionFixed === null ? null : num(row.commissionFixed),
    paymentStatus: row.paymentStatus,
    paidAt: isoOrNull(row.paidAt),
    receiptUrl: row.receiptUrl,
    receiptName: row.receiptName,
    receiptUploadedAt: isoOrNull(row.receiptUploadedAt),
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
    budget: row.budget === null ? null : num(row.budget),
    agencyFee: row.agencyFee === null ? null : num(row.agencyFee),
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

  const [creators, companies, campaigns, users, roles, settings, apiConnections] = await Promise.all([
    prisma.creator.findMany({ include: creatorInclude, orderBy: { createdAt: "desc" } }),
    prisma.company.findMany({ include: companyInclude, orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ include: campaignInclude, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
    readApiConnections(),
  ]);

  return {
    creators: creators.map((c) => toCreator(c, apiConnections.get(c.id) ?? [])),
    companies: companies.map(toCompany),
    campaigns: campaigns.map(toCampaign),
    users: users.map(toUser),
    roles: roles.map(toRole),
    settings: { youtubeApiKey: settings?.youtubeApiKey ?? undefined },
  };
}

/* ---------------- Creadores ---------------- */

export async function createCreator(
  input: Omit<Creator, "id" | "createdAt" | "apiConnections">,
): Promise<Creator> {
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
      contactFields: {
        create: (input.contactFields ?? []).map((f, i) => ({
          id: f.id || newId("cf"),
          label: f.label,
          value: f.value,
          position: i,
        })),
      },
      bankAccounts: {
        create: (input.bankAccounts ?? []).map((a, i) => {
          // `creatorId` lo pone Prisma al anidar la creación; aquí estorba.
          const columnas = accountToColumns(a, "", i);
          delete (columnas as Partial<typeof columnas>).creatorId;
          return columnas;
        }),
      },
      rates: {
        create: (input.rates ?? [])
          .filter((r) => r.amount > 0)
          .map((r) => ({
            id: r.id || newId("rt"),
            platform: r.platform,
            type: r.type,
            amount: r.amount,
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
  if (
    patch.channels !== undefined ||
    patch.socials !== undefined ||
    patch.contactFields !== undefined ||
    patch.bankAccounts !== undefined
  ) {
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
    if (patch.contactFields !== undefined) {
      await tx.creatorContactField.deleteMany({ where: { creatorId: id } });
      for (const [i, campo] of patch.contactFields.entries()) {
        await tx.creatorContactField.create({
          data: {
            id: campo.id || newId("cf"),
            creatorId: id,
            label: campo.label,
            value: campo.value,
            position: i,
          },
        });
      }
    }
    if (patch.bankAccounts !== undefined) {
      await tx.creatorBankAccount.deleteMany({ where: { creatorId: id } });
      for (const [i, cuenta] of patch.bankAccounts.entries()) {
        await tx.creatorBankAccount.create({ data: accountToColumns(cuenta, id, i) });
      }
    }
  });

  const row = await prisma.creator.findUnique({ where: { id }, include: creatorInclude });
  return row ? toCreator(row) : null;
}

/** Datos bancarios completos. Solo para la ruta que exige el código de acceso. */
export async function revealBanking(
  creatorId: string,
): Promise<{ banking: BankingInfo; accounts: BankingAccount[] } | null> {
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
      bankAccounts: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!row) return null;
  return { banking: fullBanking(row), accounts: row.bankAccounts.map(fullAccount) };
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
  // Las tarifas del canal van detrás. No hay cascada que las arrastre: en
  // `CreatorRate` el canal es texto suelto, no una relación, y quedarse con
  // tarifas de un canal que ya no existe es dejar precios fantasma que nadie
  // vuelve a ver ni a corregir.
  const [, borrado] = await prisma.$transaction([
    prisma.creatorRate.deleteMany({ where: { creatorId, channelId } }),
    prisma.creatorChannel.deleteMany({ where: { creatorId, id: channelId } }),
  ]);
  return borrado.count > 0;
}

export async function setCreatorSocials(
  creatorId: string,
  socials: SocialLink[],
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;
  return replaceCreatorLists(creatorId, { socials });
}

/* ---------------- Conexiones de API del creador ---------------- */

/**
 * Guarda (o reemplaza) la clave de API de una plataforma para un creador. El
 * secreto se cifra aquí y solo se conservan los últimos 4 caracteres en claro
 * para poder reconocerlo en la ficha.
 */
export async function setCreatorApiKey(
  creatorId: string,
  platform: CreatorApiConnection["platform"],
  secret: string,
  externalId = "",
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;

  const secretEnc = encrypt(secret);
  const secretLast4 = secret.slice(-4);

  await prisma.creatorApiConnection.upsert({
    where: { creatorId_platform: { creatorId, platform } },
    create: { id: newId("api"), creatorId, platform, secretEnc, secretLast4, externalId },
    update: { secretEnc, secretLast4, externalId, status: "conectada", connectedAt: new Date() },
  });

  return hydrateCreator(creatorId);
}

export async function removeCreatorApiKey(
  creatorId: string,
  platform: CreatorApiConnection["platform"],
): Promise<Creator | null> {
  await prisma.creatorApiConnection.deleteMany({ where: { creatorId, platform } });
  return hydrateCreator(creatorId);
}

/** Recarga un creador con sus conexiones de API resueltas. */
async function hydrateCreator(creatorId: string): Promise<Creator | null> {
  const row = await prisma.creator.findUnique({ where: { id: creatorId }, include: creatorInclude });
  if (!row) return null;
  const conns = (await readApiConnections()).get(creatorId) ?? [];
  return toCreator(row, conns);
}

/** Devuelve la clave descifrada para uso interno (sync de analítica). Nunca a la vista. */
export async function getCreatorApiKey(
  creatorId: string,
  platform: CreatorApiConnection["platform"],
): Promise<string | null> {
  const row = await prisma.creatorApiConnection.findUnique({
    where: { creatorId_platform: { creatorId, platform } },
    select: { secretEnc: true },
  });
  return row ? decrypt(row.secretEnc) : null;
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
    platform: input.platform ?? "youtube",
    channelId: input.channelId ?? "",
    clientPrice: input.clientPrice ?? 0,
    commissionPct: input.commissionPct,
    commissionFixed: input.commissionFixed,
    agreedFee: input.agreedFee ?? 0,
    paymentStatus: input.paymentStatus ?? "pendiente",
    paidAt: toDate(input.paidAt),
    receiptUrl: input.receiptUrl ?? null,
    receiptName: input.receiptName ?? null,
    receiptUploadedAt: toDate(input.receiptUploadedAt),
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

/**
 * Borra una campaña con todo lo que cuelga de ella.
 *
 * Los entregables caen solos por la cascada del esquema. Las sesiones no: su
 * `campaignId` está en `SetNull`, así que sobrevivirían sueltas y —esto es lo
 * grave— con sus códigos de portal todavía válidos. Una campaña borrada no
 * puede dejar puertas abiertas, así que se borran aquí a mano.
 *
 * Devuelve cuántas sesiones se llevó por delante, para poder decírselo a quien
 * confirmó el borrado.
 */
export async function deleteCampaign(
  id: string,
): Promise<{ ok: boolean; sesiones: number }> {
  const existe = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return { ok: false, sesiones: 0 };

  return prisma.$transaction(async (tx) => {
    const { count: sesiones } = await tx.collabSession.deleteMany({ where: { campaignId: id } });
    await tx.campaign.delete({ where: { id } });
    return { ok: true, sesiones };
  });
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
  requirements: { orderBy: { position: "asc" } },
  events: { orderBy: { createdAt: "desc" }, take: 50 },
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
      hasPin: Boolean(a.pinHash),
      lockedUntil: isoOrNull(a.lockedUntil),
      lastSeenAt: isoOrNull(a.lastSeenAt),
      createdAt: iso(a.createdAt),
    })),
    items: row.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      url: i.url,
      notes: i.notes,
      fileName: i.fileName,
      fileSize: i.fileSize,
      contentType: i.contentType,
      authorRole: i.authorRole,
      authorLabel: i.authorLabel,
      createdAt: iso(i.createdAt),
    })),
    requirements: row.requirements.map(toRequirement),
    events: row.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      message: e.message,
      actorLabel: e.actorLabel,
      unreadAgency: e.unreadAgency,
      unreadCreator: e.unreadCreator,
      createdAt: iso(e.createdAt),
    })),
    createdAt: iso(row.createdAt),
  };
}

function toRequirement(row: SessionRow["requirements"][number]): SessionRequirement {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    instructions: row.instructions,
    steps: row.steps,
    position: row.position,
    required: row.required,
    status: row.status,
    url: row.url,
    notes: row.notes,
    submittedAt: isoOrNull(row.submittedAt),
    reviewedAt: isoOrNull(row.reviewedAt),
    reviewNotes: row.reviewNotes,
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
  patch: {
    name?: string;
    status?: SessionStatus;
    notes?: string;
    showMetrics?: boolean;
    /** Null desvincula: la sesión queda suelta, no se borra. */
    campaignId?: string | null;
    creatorId?: string | null;
  },
): Promise<CollabSession | null> {
  const existe = await prisma.collabSession.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const { campaignId, creatorId, ...resto } = patch;
  const data: Prisma.CollabSessionUpdateInput = { ...resto };

  if (campaignId !== undefined) {
    data.campaign = campaignId ? { connect: { id: campaignId } } : { disconnect: true };
  }
  if (creatorId !== undefined) {
    data.creator = creatorId ? { connect: { id: creatorId } } : { disconnect: true };
  }

  await prisma.collabSession.update({ where: { id }, data });
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
    /** Datos del archivo si se subió. Ausentes si `url` es un enlace pegado. */
    fileName?: string | null;
    fileSize?: number | null;
    contentType?: string | null;
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
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      contentType: input.contentType ?? null,
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
    fileName: row.fileName,
    fileSize: row.fileSize,
    contentType: row.contentType,
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
): Promise<{
  id: string;
  role: PortalRole;
  label: string;
  canUpload: boolean;
  hasPin: boolean;
} | null> {
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
    hasPin: Boolean(encontrado.pinHash),
  };
}

/* ---------------- Contactos del creador ---------------- */

/**
 * Reemplaza la lista completa de contactos.
 *
 * Se sustituye entera en vez de ir uno a uno porque el panel edita la lista
 * como un bloque, igual que en empresas.
 */
export async function setCreatorContacts(
  creatorId: string,
  contacts: Omit<Contact, "id">[],
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;

  // Si nadie está marcado, el primero manda: la ficha no debe quedarse huérfana.
  const conPrincipal =
    contacts.length > 0 && !contacts.some((c) => c.primary)
      ? contacts.map((c, i) => ({ ...c, primary: i === 0 }))
      : contacts;

  await prisma.$transaction([
    prisma.creatorContact.deleteMany({ where: { creatorId } }),
    prisma.creatorContact.createMany({
      data: conPrincipal.map((c) => ({
        id: newId("cc"),
        creatorId,
        name: c.name,
        role: c.role ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        primary: c.primary ?? false,
        notes: c.notes ?? "",
      })),
    }),
  ]);

  const row = await prisma.creator.findUnique({ where: { id: creatorId }, include: creatorInclude });
  return row ? toCreator(row) : null;
}

/* ---------------- Catálogo de categorías ---------------- */

/**
 * Categorías que se ofrecen al clasificar un creador.
 *
 * La tabla vacía significa «nunca se tocó el catálogo», no «no hay ninguna»:
 * en ese caso se siembra con las de siempre para que una instalación recién
 * hecha se comporte igual que antes. Que no pueda quedarse vacía lo garantiza
 * la ruta, que rechaza guardar una lista sin nada.
 */
export async function listCreatorCategories(): Promise<string[]> {
  const rows = await prisma.creatorCategory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  if (rows.length > 0) return rows.map((r) => r.name);

  await prisma.creatorCategory.createMany({
    data: CATEGORIAS_INICIALES.map((name, i) => ({ id: newId("cat"), name, position: i })),
    skipDuplicates: true,
  });
  return [...CATEGORIAS_INICIALES];
}

/**
 * Reemplaza el catálogo entero, en el orden recibido.
 *
 * Borrar una categoría de aquí no toca las fichas que la usaban: `category` es
 * texto en el creador, no una relación. Deja de ofrecerse al elegir, y la ficha
 * vieja sigue enseñando la suya hasta que alguien la cambie a mano.
 */
export async function setCreatorCategories(names: string[]): Promise<string[]> {
  // Sin duplicados y sin distinguir mayúsculas: «Gaming» y «gaming» son una.
  const vistas = new Set<string>();
  const limpias = names
    .map((n) => n.trim())
    .filter((n) => {
      const llave = n.toLowerCase();
      if (!n || vistas.has(llave)) return false;
      vistas.add(llave);
      return true;
    });

  await prisma.$transaction([
    prisma.creatorCategory.deleteMany({}),
    prisma.creatorCategory.createMany({
      data: limpias.map((name, i) => ({ id: newId("cat"), name, position: i })),
    }),
  ]);

  return limpias;
}

/** Reemplaza los contactos de nombre libre (Discord, Telegram…) del creador. */
export async function setCreatorContactFields(
  creatorId: string,
  fields: Omit<ContactField, "id">[],
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;
  return replaceCreatorLists(creatorId, {
    contactFields: fields.map((f) => ({ id: "", label: f.label, value: f.value })),
  });
}

/** Reemplaza las cuentas de cobro del creador. Cifra al escribir. */
export async function setCreatorBankAccounts(
  creatorId: string,
  accounts: Omit<BankingAccount, "id">[],
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;
  return replaceCreatorLists(creatorId, {
    bankAccounts: accounts.map((a) => ({ ...a, id: "" })),
  });
}

/* ---------------- Estado de pago ---------------- */

/**
 * Marca una pieza como pendiente, aprobada o pagada.
 *
 * Deja constancia en la sesión del creador: es la vía por la que se entera de
 * que su dinero salió, sin que nadie tenga que escribirle.
 */
/**
 * Adjunta o quita el comprobante del pago de una pieza.
 *
 * Va aparte de `updateDeliverable` porque no toca dinero: no recalcula nada ni
 * avisa al creador de un cambio de estado que no ha habido.
 */
export async function setDeliverableReceipt(
  campaignId: string,
  deliverableId: string,
  patch: { receiptUrl: string | null; receiptName: string | null },
): Promise<Campaign | null> {
  const { count } = await prisma.deliverable.updateMany({
    where: { id: deliverableId, campaignId },
    data: {
      receiptUrl: patch.receiptUrl,
      receiptName: patch.receiptName,
      receiptUploadedAt: patch.receiptUrl ? new Date() : null,
    },
  });
  if (count === 0) return null;

  const row = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: campaignInclude,
  });
  return row ? toCampaign(row) : null;
}

export async function updateDeliverable(
  campaignId: string,
  deliverableId: string,
  patch: {
    status?: Deliverable["status"];
    paymentStatus?: Deliverable["paymentStatus"];
    clientPrice?: number;
    commissionPct?: number | null;
    commissionFixed?: number | null;
  },
): Promise<Campaign | null> {
  const actual = await prisma.deliverable.findFirst({
    where: { id: deliverableId, campaignId },
    include: { campaign: { select: { agencyFee: true } } },
  });
  if (!actual) return null;

  const data: Prisma.DeliverableUpdateManyMutationInput = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.clientPrice !== undefined) data.clientPrice = patch.clientPrice;
  if (patch.commissionPct !== undefined) data.commissionPct = patch.commissionPct;
  if (patch.commissionFixed !== undefined) data.commissionFixed = patch.commissionFixed;

  if (patch.paymentStatus !== undefined) {
    data.paymentStatus = patch.paymentStatus;
    data.paidAt = patch.paymentStatus === "pagado" ? new Date() : null;
  }

  // Si cambió el dinero, se recalcula lo que le queda al creador.
  if (
    patch.clientPrice !== undefined ||
    patch.commissionPct !== undefined ||
    patch.commissionFixed !== undefined
  ) {
    const cobro = patch.clientPrice ?? num(actual.clientPrice);
    const fija =
      patch.commissionFixed !== undefined
        ? patch.commissionFixed
        : actual.commissionFixed === null
          ? null
          : num(actual.commissionFixed);
    const pct =
      patch.commissionPct !== undefined
        ? patch.commissionPct
        : actual.commissionPct === null
          ? null
          : num(actual.commissionPct);

    const comision =
      fija !== null
        ? Math.min(fija, cobro)
        : cobro * ((pct ?? num(actual.campaign.agencyFee)) / 100);

    data.agreedFee = cobro - comision;
  }

  await prisma.deliverable.updateMany({ where: { id: deliverableId, campaignId }, data });

  if (patch.paymentStatus !== undefined) {
    await avisarPago(campaignId, actual.creatorId, patch.paymentStatus);
  }

  const row = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: campaignInclude,
  });
  return row ? toCampaign(row) : null;
}

export async function removeDeliverable(
  campaignId: string,
  deliverableId: string,
): Promise<boolean> {
  const { count } = await prisma.deliverable.deleteMany({
    where: { id: deliverableId, campaignId },
  });
  return count > 0;
}

/** Deja constancia del pago en la sesión del creador, para que se entere él. */
async function avisarPago(
  campaignId: string,
  creatorId: string,
  paymentStatus: Deliverable["paymentStatus"],
): Promise<void> {
  const sesion = await prisma.collabSession.findFirst({
    where: { campaignId, creatorId },
    select: { id: true },
  });
  if (!sesion) return;

  const texto = {
    pendiente: "vuelve a estar pendiente",
    aprobado: "quedó aprobado",
    pagado: "ya salió",
  };

  await logSessionEvent(sesion.id, {
    kind: "pago",
    message: `El pago ${texto[paymentStatus]}`,
    actorLabel: "Agencia",
    unreadAgency: false,
    unreadCreator: true,
  });
}

/* ---------------- PIN del portal ---------------- */

export type PortalAccess = {
  id: string;
  sessionId: string;
  role: PortalRole;
  label: string;
  canUpload: boolean;
  hasPin: boolean;
  pinHash: string | null;
  lockedUntil: Date | null;
  failedAttempts: number;
};

export async function getPortalAccess(accessId: string): Promise<PortalAccess | null> {
  const row = await prisma.sessionAccess.findUnique({
    where: { id: accessId },
    include: { session: { select: { status: true } } },
  });
  if (!row || row.revoked || row.session.status === "cerrada") return null;

  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    label: row.label,
    canUpload: row.canUpload,
    hasPin: Boolean(row.pinHash),
    pinHash: row.pinHash,
    lockedUntil: row.lockedUntil,
    failedAttempts: row.failedAttempts,
  };
}

export async function setAccessPin(accessId: string, pinHash: string): Promise<void> {
  await prisma.sessionAccess.update({
    where: { id: accessId },
    data: { pinHash, pinSetAt: new Date(), failedAttempts: 0, lockedUntil: null },
  });
}

/** Suma un fallo de PIN y bloquea el acceso al quinto. Devuelve los restantes. */
export async function registerPinFailure(accessId: string): Promise<number> {
  const MAXIMO = 5;
  const BLOQUEO_MINUTOS = 15;

  const row = await prisma.sessionAccess.update({
    where: { id: accessId },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  });

  if (row.failedAttempts >= MAXIMO) {
    await prisma.sessionAccess.update({
      where: { id: accessId },
      data: { lockedUntil: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) },
    });
    return 0;
  }
  return MAXIMO - row.failedAttempts;
}

export async function clearPinFailures(accessId: string): Promise<void> {
  await prisma.sessionAccess.update({
    where: { id: accessId },
    data: { failedAttempts: 0, lockedUntil: null, lastSeenAt: new Date() },
  });
}

/* ---------------- Peticiones de la sesión ---------------- */

export async function addRequirement(
  sessionId: string,
  input: {
    kind: SessionItemKind;
    title: string;
    instructions?: string;
    steps?: string[];
    required?: boolean;
  },
): Promise<CollabSession | null> {
  const existe = await prisma.collabSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!existe) return null;

  const ultimo = await prisma.sessionRequirement.findFirst({
    where: { sessionId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.sessionRequirement.create({
    data: {
      id: newId("rq"),
      sessionId,
      kind: input.kind,
      title: input.title,
      instructions: input.instructions ?? "",
      steps: input.steps ?? [],
      required: input.required ?? true,
      position: (ultimo?.position ?? -1) + 1,
    },
  });

  return getCollabSession(sessionId);
}

export async function updateRequirement(
  sessionId: string,
  requirementId: string,
  patch: Partial<{
    title: string;
    instructions: string;
    steps: string[];
    required: boolean;
    position: number;
  }>,
): Promise<CollabSession | null> {
  const { count } = await prisma.sessionRequirement.updateMany({
    where: { id: requirementId, sessionId },
    data: patch,
  });
  if (count === 0) return null;
  return getCollabSession(sessionId);
}

export async function removeRequirement(
  sessionId: string,
  requirementId: string,
): Promise<boolean> {
  const { count } = await prisma.sessionRequirement.deleteMany({
    where: { id: requirementId, sessionId },
  });
  return count > 0;
}

/** El creador entrega: pasa a «enviado» y queda pendiente de revisión. */
export async function submitRequirement(
  sessionId: string,
  requirementId: string,
  input: { url: string; notes?: string; actorLabel: string },
): Promise<CollabSession | null> {
  const { count } = await prisma.sessionRequirement.updateMany({
    where: { id: requirementId, sessionId },
    data: {
      url: input.url,
      notes: input.notes ?? "",
      status: "enviado",
      submittedAt: new Date(),
      reviewedAt: null,
      reviewNotes: "",
    },
  });
  if (count === 0) return null;

  const req = await prisma.sessionRequirement.findUnique({
    where: { id: requirementId },
    select: { title: true },
  });
  await logSessionEvent(sessionId, {
    kind: "entrega",
    message: `Entregó «${req?.title ?? "una petición"}»`,
    actorLabel: input.actorLabel,
    unreadAgency: true,
    unreadCreator: false,
  });

  return getCollabSession(sessionId);
}

/** La agencia revisa: aprueba o pide cambios. */
export async function reviewRequirement(
  sessionId: string,
  requirementId: string,
  input: { aprobado: boolean; reviewNotes?: string; actorLabel: string },
): Promise<CollabSession | null> {
  const estado = input.aprobado ? "aprobado" : "cambios";

  const { count } = await prisma.sessionRequirement.updateMany({
    where: { id: requirementId, sessionId },
    data: { status: estado, reviewedAt: new Date(), reviewNotes: input.reviewNotes ?? "" },
  });
  if (count === 0) return null;

  const req = await prisma.sessionRequirement.findUnique({
    where: { id: requirementId },
    select: { title: true },
  });
  await logSessionEvent(sessionId, {
    kind: input.aprobado ? "aprobacion" : "cambios",
    message: input.aprobado
      ? `Aprobó «${req?.title ?? "una petición"}»`
      : `Pidió cambios en «${req?.title ?? "una petición"}»`,
    actorLabel: input.actorLabel,
    unreadAgency: false,
    unreadCreator: true,
  });

  return getCollabSession(sessionId);
}

/* ---------------- Novedades de la sesión ---------------- */

export async function logSessionEvent(
  sessionId: string,
  input: {
    kind: SessionEventKind;
    message: string;
    actorLabel: string;
    unreadAgency?: boolean;
    unreadCreator?: boolean;
  },
): Promise<void> {
  await prisma.sessionEvent.create({
    data: {
      sessionId,
      kind: input.kind,
      message: input.message,
      actorLabel: input.actorLabel,
      unreadAgency: input.unreadAgency ?? true,
      unreadCreator: input.unreadCreator ?? true,
    },
  });
}

export async function markEventsRead(sessionId: string, lado: "agencia" | "creador"): Promise<void> {
  await prisma.sessionEvent.updateMany({
    where: { sessionId },
    data: lado === "agencia" ? { unreadAgency: false } : { unreadCreator: false },
  });
}

/* ---------------- Tarifas por red social ---------------- */

/**
 * Reemplaza el tarifario completo del creador.
 *
 * La ficha edita todas las tarifas de una vez, así que se borra y se vuelve a
 * escribir: si se fuera haciendo `upsert` fila a fila, quitar una tarifa en la
 * pantalla no la borraría de la base y volvería a aparecer al recargar.
 *
 * Las de importe cero no se guardan: equivalen a no tener tarifa y hacen que
 * `rateFor` caiga en la de respaldo.
 */
export async function setCreatorRates(
  creatorId: string,
  rates: Omit<CreatorRate, "id">[],
): Promise<Creator | null> {
  const existe = await prisma.creator.findUnique({ where: { id: creatorId }, select: { id: true } });
  if (!existe) return null;

  await prisma.$transaction(async (tx) => {
    await tx.creatorRate.deleteMany({ where: { creatorId } });
    for (const r of rates) {
      if (r.amount <= 0) continue;
      await tx.creatorRate.create({
        data: {
          id: newId("rt"),
          creatorId,
          platform: r.platform,
          type: r.type,
          amount: r.amount,
          channelId: r.channelId ?? "",
        },
      });
    }
  });

  const row = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: creatorInclude,
  });
  return row ? toCreator(row) : null;
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

/* ---------------- Notas y documentos ---------------- */

const folderInclude = {
  _count: { select: { docs: true } },
} satisfies Prisma.FolderInclude;

function toFolder(row: Prisma.FolderGetPayload<{ include: typeof folderInclude }>): Folder {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    parentId: row.parentId,
    position: row.position,
    docCount: row._count.docs,
    createdAt: iso(row.createdAt),
  };
}

const docInclude = { links: true } satisfies Prisma.DocInclude;
type DocRow = Prisma.DocGetPayload<{ include: typeof docInclude }>;

function toDoc(row: DocRow): Doc {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    plainText: row.plainText,
    excerpt: row.excerpt,
    icon: row.icon,
    folderId: row.folderId,
    createdById: row.createdById,
    updatedById: row.updatedById,
    archived: row.archived,
    pinned: row.pinned,
    links: row.links.map((l) => ({
      id: l.id,
      campaignId: l.campaignId,
      creatorId: l.creatorId,
      companyId: l.companyId,
    })),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toSummary(row: DocRow): DocSummary {
  const { content, plainText, ...resto } = toDoc(row);
  void content;
  void plainText;
  return resto;
}

export async function listFolders(): Promise<Folder[]> {
  const rows = await prisma.folder.findMany({
    include: folderInclude,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toFolder);
}

export async function createFolder(input: {
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
}): Promise<Folder> {
  const ultimo = await prisma.folder.findFirst({
    where: { parentId: input.parentId ?? null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const row = await prisma.folder.create({
    data: {
      id: newId("fo"),
      name: input.name,
      parentId: input.parentId ?? null,
      icon: input.icon ?? "folder",
      color: input.color ?? "#4f7cff",
      position: (ultimo?.position ?? -1) + 1,
    },
    include: folderInclude,
  });
  return toFolder(row);
}

export async function updateFolder(
  id: string,
  patch: Partial<Pick<Folder, "name" | "icon" | "color" | "parentId" | "position">>,
): Promise<Folder | null> {
  const existe = await prisma.folder.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  // Una carpeta dentro de sí misma dejaría el árbol en un bucle infinito.
  if (patch.parentId === id) return null;

  const row = await prisma.folder.update({
    where: { id },
    data: patch,
    include: folderInclude,
  });
  return toFolder(row);
}

/** Borra la carpeta y sus hijas; las notas se quedan sueltas, no se pierden. */
export async function removeFolder(id: string): Promise<boolean> {
  const { count } = await prisma.folder.deleteMany({ where: { id } });
  return count > 0;
}

export async function listDocs(filtro?: {
  folderId?: string | null;
  archived?: boolean;
  campaignId?: string;
  creatorId?: string;
  companyId?: string;
}): Promise<DocSummary[]> {
  const enlace = filtro?.campaignId
    ? { links: { some: { campaignId: filtro.campaignId } } }
    : filtro?.creatorId
      ? { links: { some: { creatorId: filtro.creatorId } } }
      : filtro?.companyId
        ? { links: { some: { companyId: filtro.companyId } } }
        : {};

  const rows = await prisma.doc.findMany({
    where: {
      archived: filtro?.archived ?? false,
      ...(filtro?.folderId !== undefined ? { folderId: filtro.folderId } : {}),
      ...enlace,
    },
    include: docInclude,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toSummary);
}

/**
 * Busca en el texto plano y en el título.
 *
 * Insensible a mayúsculas, sin depender de `tsvector`: con el volumen de notas
 * de una agencia, un `contains` es de sobra y no obliga a mantener un índice.
 */
export async function searchDocs(texto: string): Promise<DocSummary[]> {
  const q = texto.trim();
  if (!q) return [];

  const rows = await prisma.doc.findMany({
    where: {
      archived: false,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { plainText: { contains: q, mode: "insensitive" } },
      ],
    },
    include: docInclude,
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return rows.map(toSummary);
}

export async function getDoc(id: string): Promise<Doc | null> {
  const row = await prisma.doc.findUnique({ where: { id }, include: docInclude });
  return row ? toDoc(row) : null;
}

export async function createDoc(input: {
  title?: string;
  folderId?: string | null;
  createdById?: string | null;
  links?: Omit<DocLink, "id">[];
}): Promise<Doc> {
  const row = await prisma.doc.create({
    data: {
      id: newId("dc"),
      title: input.title?.trim() || "Sin título",
      folderId: input.folderId ?? null,
      createdById: input.createdById ?? null,
      updatedById: input.createdById ?? null,
      links: {
        create: (input.links ?? []).map((l) => ({
          id: newId("dl"),
          campaignId: l.campaignId,
          creatorId: l.creatorId,
          companyId: l.companyId,
        })),
      },
    },
    include: docInclude,
  });
  return toDoc(row);
}

export async function updateDoc(
  id: string,
  patch: {
    title?: string;
    content?: unknown;
    plainText?: string;
    icon?: string;
    folderId?: string | null;
    archived?: boolean;
    pinned?: boolean;
    updatedById?: string | null;
    links?: Omit<DocLink, "id">[];
  },
): Promise<Doc | null> {
  const existe = await prisma.doc.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: Prisma.DocUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.trim() || "Sin título";
  if (patch.content !== undefined) data.content = patch.content as Prisma.InputJsonValue;
  if (patch.icon !== undefined) data.icon = patch.icon;
  if (patch.archived !== undefined) data.archived = patch.archived;
  if (patch.pinned !== undefined) data.pinned = patch.pinned;
  if (patch.updatedById !== undefined) data.updatedById = patch.updatedById;
  if (patch.folderId !== undefined) {
    data.folder = patch.folderId ? { connect: { id: patch.folderId } } : { disconnect: true };
  }

  if (patch.plainText !== undefined) {
    data.plainText = patch.plainText;
    // El resumen se recorta en la frontera de una palabra, no a mitad de una.
    const limpio = patch.plainText.replace(/\s+/g, " ").trim();
    data.excerpt =
      limpio.length <= 160 ? limpio : `${limpio.slice(0, limpio.lastIndexOf(" ", 160))}…`;
  }

  if (patch.links) {
    await prisma.docLink.deleteMany({ where: { docId: id } });
    if (patch.links.length > 0) {
      await prisma.docLink.createMany({
        data: patch.links.map((l) => ({
          id: newId("dl"),
          docId: id,
          campaignId: l.campaignId,
          creatorId: l.creatorId,
          companyId: l.companyId,
        })),
      });
    }
  }

  const row = await prisma.doc.update({ where: { id }, data, include: docInclude });
  return toDoc(row);
}

export async function removeDoc(id: string): Promise<boolean> {
  const { count } = await prisma.doc.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * Refresca las métricas de una pieza y guarda una foto del momento.
 *
 * El histórico se escribe en la misma transacción que la actualización: si
 * una falla, la otra no debe quedarse a medias y descuadrar la evolución.
 */
export async function refreshDeliverableMetrics(
  campaignId: string,
  deliverableId: string,
  metricas: { views: number; likes: number | null; comments: number | null },
): Promise<boolean> {
  const existe = await prisma.deliverable.findFirst({
    where: { id: deliverableId, campaignId },
    select: { id: true },
  });
  if (!existe) return false;

  const vistas = BigInt(Math.max(0, Math.trunc(metricas.views)));

  await prisma.$transaction([
    prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        views: vistas,
        likes: metricas.likes,
        comments: metricas.comments,
        metricsUpdatedAt: new Date(),
      },
    }),
    prisma.metricSnapshot.create({
      data: {
        deliverableId,
        views: vistas,
        likes: metricas.likes,
        comments: metricas.comments,
      },
    }),
  ]);

  return true;
}

/**
 * Duplica una campaña con sus creadores y precios.
 *
 * Copia el acuerdo comercial —quién, en qué red, por cuánto— pero no el
 * resultado: las piezas vuelven a «pendiente» sin video ni métricas, porque
 * son publicaciones nuevas. Copiar las vistas de la campaña anterior
 * falsearía los informes desde el primer día.
 */
export async function duplicateCampaign(
  id: string,
  input: { name: string; startDate?: string; conSesiones?: boolean },
): Promise<Campaign | null> {
  const original = await prisma.campaign.findUnique({
    where: { id },
    include: { deliverables: true },
  });
  if (!original) return null;

  const nueva = await prisma.campaign.create({
    data: {
      id: newId("cp"),
      name: input.name,
      companyId: original.companyId,
      // Siempre borrador: una copia no debería salir activa por accidente.
      status: "borrador",
      objective: original.objective,
      currency: original.currency,
      budget: original.budget,
      agencyFee: original.agencyFee,
      startDate: toDate(input.startDate) ?? new Date(),
      endDate: null,
      notes: original.notes,
      deliverables: {
        create: original.deliverables.map((d) => ({
          id: newId("dl"),
          creatorId: d.creatorId,
          type: d.type,
          platform: d.platform,
          status: "pendiente" as const,
          clientPrice: d.clientPrice,
          commissionPct: d.commissionPct,
          commissionFixed: d.commissionFixed,
          agreedFee: d.agreedFee,
          paymentStatus: "pendiente" as const,
        })),
      },
    },
    include: campaignInclude,
  });

  // Cada creador vuelve a necesitar su espacio, con códigos nuevos: los de la
  // campaña anterior siguen sirviendo para aquella y no deben mezclarse.
  if (input.conSesiones !== false) {
    const creadores = [...new Set(original.deliverables.map((d) => d.creatorId))];
    const fichas = await prisma.creator.findMany({
      where: { id: { in: creadores } },
      select: { id: true, name: true },
    });

    await Promise.all(
      fichas.map((c) =>
        createCollabSession({
          name: `${nueva.name} · ${c.name}`,
          campaignId: nueva.id,
          creatorId: c.id,
          accesses: [{ role: "creador", label: c.name, canUpload: true }],
        }),
      ),
    );
  }

  return toCampaign(nueva);
}
