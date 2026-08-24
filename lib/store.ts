import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  Campaign,
  Company,
  Contact,
  Creator,
  CreatorChannel,
  Deliverable,
  PublicUser,
  Role,
  SocialLink,
  User,
} from "@/lib/types";

/**
 * Persistencia en archivo mientras no hay base de datos.
 * Guarda en `.data/konnect.json`; la primera vez siembra con los datos de ejemplo.
 * Al conectar Neon, estas funciones se reemplazan por consultas Prisma.
 */

export type Settings = {
  /** Clave de YouTube guardada desde Configuración. `YOUTUBE_API_KEY` tiene prioridad. */
  youtubeApiKey?: string;
};

export type Database = {
  creators: Creator[];
  companies: Company[];
  campaigns: Campaign[];
  users: User[];
  roles: Role[];
  settings: Settings;
};

const FILE = path.join(process.cwd(), ".data", "konnect.json");

/**
 * Base vacía. Los únicos datos de arranque son los roles del sistema; el resto
 * lo crea el equipo desde la aplicación.
 */
function seed(): Database {
  const now = new Date().toISOString();
  return {
    creators: [],
    companies: [],
    campaigns: [],
    users: [],
    roles: [
      {
        id: "rol_admin",
        name: "Administración",
        color: "#0046d9",
        permissions: ["*"],
        system: true,
        createdAt: now,
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
        createdAt: now,
      },
    ],
    settings: {},
  };
}

/**
 * Cola de un solo carril: varias peticiones llegan en paralelo y sin esto se
 * pisan al escribir (en Windows el `rename` de la segunda falla con ENOENT).
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  // La cola no debe romperse si una tarea falla.
  queue = next.catch(() => undefined);
  return next;
}

async function write(db: Database) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  // Temporal único por escritura: dos procesos nunca compiten por el mismo nombre.
  const tmp = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

/**
 * Rellena campos que se añadieron después de que se guardaran los datos, para
 * que un archivo viejo no rompa la aplicación.
 */
function normalizar(db: Database): Database {
  db.creators = db.creators.map((c) => ({
    ...c,
    channels: c.channels ?? [],
    socials: c.socials ?? [],
  }));

  db.companies = db.companies.map((c) => {
    if (c.contacts?.length) return c;
    // Antes solo había un contacto suelto: pasa a ser el principal.
    const contacts: Contact[] = c.contactName?.trim()
      ? [
          {
            id: newId("ct"),
            name: c.contactName,
            role: c.contactRole ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
            primary: true,
            notes: "",
          },
        ]
      : [];
    return { ...c, contacts };
  });

  return db;
}

async function load(): Promise<Database> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return normalizar({
      creators: parsed.creators ?? [],
      companies: parsed.companies ?? [],
      campaigns: parsed.campaigns ?? [],
      users: parsed.users ?? [],
      roles: parsed.roles?.length ? parsed.roles : seed().roles,
      settings: parsed.settings ?? {},
    });
  } catch {
    const fresh = seed();
    await write(fresh);
    return fresh;
  }
}

export function read(): Promise<Database> {
  return serialize(load);
}

function mutate<T>(fn: (db: Database) => T): Promise<T> {
  return serialize(async () => {
    const db = await load();
    const result = fn(db);
    await write(db);
    return result;
  });
}

/** Identificador corto y legible: `cr_l8x2p9`. */
export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------------- Creadores ---------------- */

export function createCreator(input: Omit<Creator, "id" | "createdAt">): Promise<Creator> {
  return mutate((db) => {
    const creator: Creator = { ...input, id: newId("cr"), createdAt: new Date().toISOString() };
    db.creators.unshift(creator);
    return creator;
  });
}

export function updateCreator(id: string, patch: Partial<Creator>): Promise<Creator | null> {
  return mutate((db) => {
    const index = db.creators.findIndex((c) => c.id === id);
    if (index === -1) return null;
    db.creators[index] = { ...db.creators[index], ...patch, id };
    return db.creators[index];
  });
}

/* ---------------- Empresas ---------------- */

export function createCompany(input: Omit<Company, "id" | "createdAt">): Promise<Company> {
  return mutate((db) => {
    const company: Company = { ...input, id: newId("co"), createdAt: new Date().toISOString() };
    db.companies.unshift(company);
    return company;
  });
}

/* ---------------- Campañas ---------------- */

export function createCampaign(
  input: Omit<Campaign, "id" | "createdAt" | "deliverables"> & { deliverables?: Deliverable[] },
): Promise<Campaign> {
  return mutate((db) => {
    const campaign: Campaign = {
      ...input,
      deliverables: input.deliverables ?? [],
      id: newId("cp"),
      createdAt: new Date().toISOString(),
    };
    db.campaigns.unshift(campaign);
    return campaign;
  });
}

export function addDeliverable(
  campaignId: string,
  input: Omit<Deliverable, "id">,
): Promise<Deliverable | null> {
  return mutate((db) => {
    const campaign = db.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return null;
    const deliverable: Deliverable = { ...input, id: newId("dl") };
    campaign.deliverables.push(deliverable);
    return deliverable;
  });
}

/* ---------------- Ajustes ---------------- */

export async function getSettings(): Promise<Settings> {
  return (await read()).settings;
}

export function saveSettings(patch: Settings): Promise<Settings> {
  return mutate((db) => {
    db.settings = { ...db.settings, ...patch };
    return db.settings;
  });
}

/** Deja la base como recién sembrada. Útil al probar. */
export function resetDatabase() {
  return serialize(async () => {
    const fresh = seed();
    await write(fresh);
    return fresh;
  });
}

/* ---------------- Usuarios y roles ---------------- */

export async function listUsers(): Promise<User[]> {
  return (await read()).users;
}

export async function listRoles(): Promise<Role[]> {
  return (await read()).roles;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  return (await read()).users.find((u) => u.email.toLowerCase() === target) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  return (await read()).users.find((u) => u.id === id) ?? null;
}

export async function countUsers(): Promise<number> {
  return (await read()).users.length;
}

export function createUser(
  input: Omit<User, "id" | "createdAt" | "lastLoginAt">,
): Promise<User | { error: string }> {
  return mutate((db) => {
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    if (!db.roles.some((r) => r.id === input.roleId)) {
      return { error: "El rol indicado no existe." };
    }
    const user: User = {
      ...input,
      email,
      id: newId("us"),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return user;
  });
}

export function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  return mutate((db) => {
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    db.users[index] = { ...db.users[index], ...patch, id };
    return db.users[index];
  });
}

export function deleteUser(id: string): Promise<boolean> {
  return mutate((db) => {
    const before = db.users.length;
    db.users = db.users.filter((u) => u.id !== id);
    return db.users.length < before;
  });
}

export function createRole(input: Omit<Role, "id" | "createdAt">): Promise<Role> {
  return mutate((db) => {
    const role: Role = { ...input, id: newId("rol"), createdAt: new Date().toISOString() };
    db.roles.push(role);
    return role;
  });
}

export function updateRole(id: string, patch: Partial<Role>): Promise<Role | null> {
  return mutate((db) => {
    const index = db.roles.findIndex((r) => r.id === id);
    if (index === -1) return null;
    const current = db.roles[index];
    // Un rol del sistema conserva su naturaleza y sus permisos completos.
    const safe = current.system
      ? { ...patch, permissions: current.permissions, system: true }
      : patch;
    db.roles[index] = { ...current, ...safe, id };
    return db.roles[index];
  });
}

export function deleteRole(id: string): Promise<{ ok: boolean; error?: string }> {
  return mutate((db) => {
    const role = db.roles.find((r) => r.id === id);
    if (!role) return { ok: false, error: "El rol no existe." };
    if (role.system) return { ok: false, error: "Los roles del sistema no se pueden eliminar." };
    if (db.users.some((u) => u.roleId === id)) {
      return { ok: false, error: "Hay usuarios con ese rol. Reasígnalos antes de eliminarlo." };
    }
    db.roles = db.roles.filter((r) => r.id !== id);
    return { ok: true };
  });
}

/** Versión sin credenciales: lo único que puede salir hacia el cliente. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/* ---------------- Actualizaciones ---------------- */

export function updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign | null> {
  return mutate((db) => {
    const index = db.campaigns.findIndex((c) => c.id === id);
    if (index === -1) return null;
    db.campaigns[index] = { ...db.campaigns[index], ...patch, id };
    return db.campaigns[index];
  });
}

export function updateCompany(id: string, patch: Partial<Company>): Promise<Company | null> {
  return mutate((db) => {
    const index = db.companies.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const merged = { ...db.companies[index], ...patch, id };

    // El atajo del contacto principal se mantiene sincronizado con la lista.
    const principal = merged.contacts.find((c) => c.primary) ?? merged.contacts[0];
    if (principal) {
      merged.contactName = principal.name;
      merged.contactRole = principal.role;
      merged.email = principal.email;
      merged.phone = principal.phone;
    }

    db.companies[index] = merged;
    return merged;
  });
}

/** Añade un canal adicional al creador, sin duplicar por `channelId`. */
export function addCreatorChannel(
  creatorId: string,
  channel: Omit<CreatorChannel, "id">,
): Promise<{ creator: Creator } | { error: string }> {
  return mutate((db) => {
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) return { error: "Creador no encontrado." };

    if (creator.channelId === channel.channelId) {
      return { error: "Ese ya es el canal principal del creador." };
    }
    if (creator.channels.some((c) => c.channelId === channel.channelId)) {
      return { error: "Ese canal ya está en la ficha." };
    }

    creator.channels.push({ ...channel, id: newId("ch") });
    return { creator };
  });
}

export function removeCreatorChannel(creatorId: string, channelId: string): Promise<boolean> {
  return mutate((db) => {
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) return false;
    const antes = creator.channels.length;
    creator.channels = creator.channels.filter((c) => c.id !== channelId);
    return creator.channels.length < antes;
  });
}

export function setCreatorSocials(
  creatorId: string,
  socials: SocialLink[],
): Promise<Creator | null> {
  return mutate((db) => {
    const creator = db.creators.find((c) => c.id === creatorId);
    if (!creator) return null;
    creator.socials = socials;
    return creator;
  });
}
