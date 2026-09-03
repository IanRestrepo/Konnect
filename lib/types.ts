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

/**
 * Una forma concreta de pagarle al creador. Un creador cobra por donde le
 * conviene —banco en su país, PayPal para el extranjero, Binance si corre
 * prisa— y cada método pide datos distintos, así que se guardan por separado
 * en vez de aplastarlos en los campos únicos de `BankingInfo`.
 *
 * `reference`, `routing` y `notes` van cifrados: en la vista censurada llegan
 * como últimos dígitos o vacíos.
 */
export type BankingAccount = {
  id: string;
  method: PaymentMethod;
  /** Cómo la llama la agencia: "Bancolombia principal", "PayPal personal". */
  label: string;
  holder: string;
  /** Solo en transferencia. */
  bankName: string;
  /** Lo que hace falta para pagar: cuenta, correo o billetera. */
  reference: string;
  /** SWIFT, routing o red de la billetera. */
  routing: string;
  notes: string;
};

/**
 * Dato de contacto que no cabe en los campos fijos: Discord, Telegram, el
 * correo del mánager… La agencia le pone el nombre que quiera.
 */
export type ContactField = {
  id: string;
  label: string;
  value: string;
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
  /**
   * Tarifas de referencia, sin distinguir plataforma. Se mantienen para las
   * fichas antiguas; lo que manda al armar una campaña es `rates`.
   */
  rateVideo: number;
  rateShort: number;
  rateIntegration: number;
  /** Precio por plataforma y tipo de pieza. Un short de TikTok no vale lo mismo. */
  rates: CreatorRate[];
  /** Con quién se habla: el creador, su mánager, su agencia. */
  contacts: Contact[];
  /** Contactos sueltos con nombre libre: Discord, Telegram, lo que haga falta. */
  contactFields: ContactField[];
  paymentMethods: PaymentMethod[];
  /* Confidencial: cifrado en BD, revelado con código */
  banking: BankingInfo;
  /** Sus cuentas de cobro, una por método. Censuradas hasta revelarlas. */
  bankAccounts: BankingAccount[];
  notes: string;
  /** Canales adicionales del mismo creador. */
  channels: CreatorChannel[];
  /** Perfiles fuera de YouTube. */
  socials: SocialLink[];
  /** Claves de API para leer su analítica propia. Por ahora solo YouTube. */
  apiConnections: CreatorApiConnection[];
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

export type DeliverableType = "video" | "short" | "integracion" | "directo" | "post";
export type DeliverableStatus = "pendiente" | "en_revision" | "publicado" | "cancelado";
export type PaymentStatus = "pendiente" | "aprobado" | "pagado";

/** Precio de un creador para una plataforma y un tipo de pieza concretos. */
export type CreatorRate = {
  id: string;
  platform: SocialPlatform;
  type: DeliverableType;
  amount: number;
  /** Canal secundario al que aplica. Vacío = toda la red. */
  channelId: string;
};

export type Deliverable = {
  id: string;
  creatorId: string;
  type: DeliverableType;
  status: DeliverableStatus;
  /** Red social donde se publica; define qué tarifa del creador se aplicó. */
  platform: SocialPlatform;
  /** Canal secundario donde se publica. Vacío = su canal principal. */
  channelId: string;
  /** Lo que paga el cliente por esta pieza. Número base del cálculo. */
  clientPrice: number;
  /** Comisión de la agencia en % del cobro. Null = hereda el de la campaña. */
  commissionPct: number | null;
  /** Comisión en cantidad fija. Si está, manda sobre el porcentaje. */
  commissionFixed: number | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
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

export type CampaignStatus = "borrador" | "activa" | "pausada" | "finalizada" | "cancelada";
export type CampaignObjective = "awareness" | "trafico" | "conversiones" | "lanzamiento";

export type Campaign = {
  id: string;
  name: string;
  companyId: string;
  status: CampaignStatus;
  objective: CampaignObjective;
  currency: Currency;
  /** Tope de referencia, opcional. El precio real lo fija cada entregable. */
  budget: number | null;
  /** Margen por defecto de la agencia, en % sobre el pago al creador. */
  agencyFee: number | null;
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
  /** Suma de lo pactado con los creadores, sin contar cancelados. */
  spent: number;
  /** Lo que se le factura al cliente: pago al creador más el margen. */
  clientTotal: number;
  /** Beneficio bruto de la agencia: `clientTotal - spent`. */
  grossProfit: number;
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
  /** Foto de perfil. Sin ella, el avatar cae en las iniciales. */
  avatarUrl: string | null;
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

/**
 * Credencial del creador para leer su propia analítica. El secreto vive cifrado
 * en la BD y nunca llega al cliente: `hint` son sólo los últimos caracteres.
 */
export type CreatorApiConnection = {
  platform: SocialPlatform;
  /** Últimos 4 caracteres de la clave, para reconocerla sin revelarla. */
  hint: string;
  externalId: string;
  status: string;
  connectedAt: string;
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
  /** Ya eligió su PIN: a partir de ahí entra con cuatro dígitos. */
  hasPin: boolean;
  /** Bloqueado por intentos fallidos hasta esta fecha. */
  lockedUntil: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type RequirementStatus = "pendiente" | "enviado" | "cambios" | "aprobado";

/** Lo que la agencia le pide al creador: guion, borrador, entregable final… */
export type SessionRequirement = {
  id: string;
  kind: SessionItemKind;
  title: string;
  instructions: string;
  /** Pasos concretos, p. ej. «añadir el enlace en la descripción». */
  steps: string[];
  position: number;
  required: boolean;
  status: RequirementStatus;
  url: string | null;
  notes: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string;
};

export type SessionEventKind = "entrega" | "aprobacion" | "cambios" | "pago" | "nota";

/** Novedad dentro de una sesión, para avisar a cada lado de lo que pasó. */
export type SessionEvent = {
  id: string;
  kind: SessionEventKind;
  message: string;
  actorLabel: string;
  unreadAgency: boolean;
  unreadCreator: boolean;
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
  /** El checklist que la agencia le pide al creador. */
  requirements: SessionRequirement[];
  /** Novedades: entregas, aprobaciones, cambios y pagos. */
  events: SessionEvent[];
  createdAt: string;
};

/* ---------------- Avisos del desarrollador ---------------- */

export type AnnouncementTone = "info" | "ok" | "warn" | "danger";

export type Announcement = {
  id: string;
  message: string;
  tone: AnnouncementTone;
  active: boolean;
  /** Vacío = lo ve todo el mundo. Con roles = solo esos roles. */
  roleIds: string[];
  dismissible: boolean;
  createdAt: string;
};

/* ---------------- Notas y documentos ---------------- */

/** Carpeta de proyecto. Se anidan para agrupar como convenga. */
export type Folder = {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  position: number;
  /** Cuántas notas cuelgan directamente de ella. */
  docCount: number;
  createdAt: string;
};

/** A qué cosa de la agencia apunta una nota. */
export type DocLink = {
  id: string;
  campaignId: string | null;
  creatorId: string | null;
  companyId: string | null;
};

/**
 * Una nota. `content` es el documento de Tiptap; `plainText` es el mismo texto
 * aplanado, que es lo único indexable para buscar.
 */
export type Doc = {
  id: string;
  title: string;
  content: unknown;
  plainText: string;
  excerpt: string;
  icon: string;
  folderId: string | null;
  createdById: string | null;
  updatedById: string | null;
  archived: boolean;
  pinned: boolean;
  links: DocLink[];
  createdAt: string;
  updatedAt: string;
};

/** Versión ligera para listados: sin el árbol del contenido. */
export type DocSummary = Omit<Doc, "content" | "plainText">;
