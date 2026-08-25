export type Currency = "USD" | "MXN" | "COP" | "EUR";

export type CreatorStatus = "activo" | "pausado" | "prospecto" | "archivado";

export type PaymentMethod =
  | "transferencia"
  | "paypal"
  | "wise"
  | "binance"
  | "deel"
  | "efectivo";

export type BankingInfo = {
  holder: string;
  bankName: string;
  accountNumber: string;
  routing: string;
  taxId: string;
  paypalEmail?: string;
  notes?: string;
};

export type Creator = {
  id: string;
  name: string;
  handle: string;
  /** Dónde vive principalmente. No todos los creadores son de YouTube. */
  mainPlatform: SocialPlatform;
  /** Vacíos si el creador no tiene canal de YouTube. */
  channelId: string;
  channelUrl: string;
  avatarUrl: string | null;
  country: string;
  category: string;
  status: CreatorStatus;
  email: string;
  phone: string;
  /* Métricas del canal (YouTube Data API) */
  totalViews: number;
  subscribers: number;
  videoCount: number;
  metricsUpdatedAt: string;
  /* Acuerdos comerciales */
  currency: Currency;
  rateVideo: number;
  rateShort: number;
  rateIntegration: number;
  paymentMethods: PaymentMethod[];
  /* Confidencial: cifrado en BD, revelado con código */
  banking: BankingInfo;
  notes: string;
  /** Canales adicionales del mismo creador. */
  channels: CreatorChannel[];
  /** Perfiles fuera de YouTube. */
  socials: SocialLink[];
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  industry: string;
  website: string | null;
  /** Se conservan como atajo al contacto principal. */
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  /** Todas las personas con las que se habla en esa empresa. */
  contacts: Contact[];
  socials: { instagram?: string; tiktok?: string; youtube?: string; linkedin?: string };
  status: "activo" | "prospecto" | "inactivo";
  notes: string;
  createdAt: string;
};

export type DeliverableType = "video" | "short" | "integracion";
export type DeliverableStatus = "pendiente" | "en_revision" | "publicado" | "cancelado";

export type Deliverable = {
  id: string;
  creatorId: string;
  type: DeliverableType;
  status: DeliverableStatus;
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  metricsUpdatedAt: string | null;
  agreedFee: number;
};

export type CampaignStatus = "borrador" | "activa" | "pausada" | "finalizada";
export type CampaignObjective = "awareness" | "trafico" | "conversiones" | "lanzamiento";

export type Campaign = {
  id: string;
  name: string;
  companyId: string;
  status: CampaignStatus;
  objective: CampaignObjective;
  currency: Currency;
  budget: number;
  startDate: string;
  endDate: string | null;
  notes: string;
  deliverables: Deliverable[];
  createdAt: string;
};

/* Derivados de campaña — se calculan, no se guardan */
export type CampaignMetrics = {
  views: number;
  likes: number;
  comments: number;
  spent: number;
  cpm: number | null;
  engagementRate: number | null;
  published: number;
  total: number;
};

/* ---------------- Cuentas y permisos ---------------- */

export type Role = {
  id: string;
  name: string;
  /** Color de la etiqueta, como en Discord. */
  color: string;
  /** Llaves de `lib/permissions`, o ["*"] para el rol de administración. */
  permissions: string[];
  /** Los roles del sistema no se pueden borrar ni quedarse sin permisos. */
  system: boolean;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/** Usuario sin credenciales, que es lo único que sale del servidor. */
export type PublicUser = Omit<User, "passwordHash">;

/* ---------------- Canales, redes y contactos ---------------- */

/** Canal adicional de un creador: secundario, de shorts, de clips… */
export type CreatorChannel = {
  id: string;
  /** Cómo lo llama la agencia: "Secundario", "Clips", "En vivo". */
  label: string;
  channelId: string;
  channelUrl: string;
  handle: string;
  avatarUrl: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  metricsUpdatedAt: string;
};

export type SocialPlatform =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "x"
  | "twitch"
  | "kick"
  | "discord"
  | "roblox"
  | "web";

/** Perfil del creador en una plataforma, con sus propias métricas. */
export type SocialLink = {
  id: string;
  platform: SocialPlatform;
  handle: string;
  url: string;
  avatarUrl: string | null;
  /** Seguidores, suscriptores o como los llame cada plataforma. */
  followers: number;
  totalViews: number;
  contentCount: number;
  metricsUpdatedAt: string | null;
};

/** Persona de contacto en una empresa. Puede haber varias. */
export type Contact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  /** El principal encabeza la ficha y no se puede quedar sin ninguno. */
  primary: boolean;
  notes: string;
};

/* ---------------- Sesiones de entrega ---------------- */

export type SessionStatus = "abierta" | "cerrada";

/** Quién entra al portal. La agencia entra por la aplicación, no por código. */
export type PortalRole = "creador" | "cliente" | "invitado";

export type SessionItemKind = "entregable" | "guion" | "borrador" | "referencia" | "nota";

/** Un código de acceso al portal. `code` solo viaja hacia la agencia. */
export type SessionAccess = {
  id: string;
  role: PortalRole;
  label: string;
  code: string;
  codeHint: string;
  canUpload: boolean;
  revoked: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

export type SessionItem = {
  id: string;
  kind: SessionItemKind;
  title: string;
  url: string | null;
  notes: string;
  authorRole: PortalRole | null;
  authorLabel: string;
  createdAt: string;
};

/** Espacio compartido con el creador y el cliente para una colaboración. */
export type CollabSession = {
  id: string;
  name: string;
  status: SessionStatus;
  notes: string;
  campaignId: string | null;
  creatorId: string | null;
  showMetrics: boolean;
  accesses: SessionAccess[];
  items: SessionItem[];
  createdAt: string;
};

/* ---------------- Chat interno ---------------- */

export type ChatRoom = {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  /** Vacío = entra todo el equipo. Con roles = solo esos y administración. */
  roleIds: string[];
  createdAt: string;
  /** Para ordenar por actividad y marcar salas sin estrenar. */
  lastMessageAt: string | null;
  messageCount: number;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
};
