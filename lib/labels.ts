import type {
  CampaignObjective,
  CampaignStatus,
  CreatorStatus,
  DeliverableStatus,
  DeliverableType,
  PaymentMethod,
} from "@/lib/types";

type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "accent";

export const CREATOR_STATUS: Record<CreatorStatus, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "ok" },
  pausado: { label: "En pausa", tone: "warn" },
  prospecto: { label: "Prospecto", tone: "info" },
  archivado: { label: "Archivado", tone: "neutral" },
};

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  activa: { label: "Activa", tone: "ok" },
  pausada: { label: "Pausada", tone: "warn" },
  finalizada: { label: "Finalizada", tone: "info" },
  cancelada: { label: "Cancelada", tone: "danger" },
};

/**
 * Los dos estados de los que no se vuelve. Se piden confirmados y sacan la
 * campaña de la operación diaria: finalizada es que se cumplió, cancelada que
 * se cayó, y mezclarlas falsea los informes porque lo cancelado no se facturó.
 */
export const CAMPAIGN_STATUS_CIERRE: CampaignStatus[] = ["finalizada", "cancelada"];

export const CAMPAIGN_OBJECTIVE: Record<CampaignObjective, string> = {
  awareness: "Reconocimiento",
  trafico: "Tráfico",
  conversiones: "Conversiones",
  lanzamiento: "Lanzamiento",
};

/** Nombre genérico, sin red. Para nombrarlo dentro de una red usa `tareaLabel`. */
export const DELIVERABLE_TYPE: Record<DeliverableType, string> = {
  video: "Video dedicado",
  short: "Reel / Short",
  integracion: "Fracción publicitaria",
  directo: "Directo",
  post: "Publicación",
};

export const DELIVERABLE_STATUS: Record<DeliverableStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "neutral" },
  en_revision: { label: "En revisión", tone: "warn" },
  publicado: { label: "Publicado", tone: "ok" },
  cancelado: { label: "Cancelado", tone: "danger" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  paypal: "PayPal",
  wise: "Wise",
  binance: "Binance Pay",
  deel: "Deel",
  efectivo: "Efectivo",
};

/**
 * Cómo se llama en cada método el dato con el que se paga.
 *
 * Pedir «número de cuenta» para un PayPal, o «SWIFT» para un Binance, hace
 * que quien rellena la ficha tenga que adivinar dónde va cada cosa. Cada
 * método nombra sus campos y esconde los que no usa.
 */
export const PAYMENT_FIELDS: Record<
  PaymentMethod,
  {
    /** Etiqueta del dato principal. */
    reference: string;
    referencePlaceholder: string;
    /** Nombre del banco: solo tiene sentido en una transferencia. */
    bank: boolean;
    /** Segundo dato (SWIFT, red de la billetera). Null si el método no lo usa. */
    routing: string | null;
    routingPlaceholder: string;
  }
> = {
  transferencia: {
    reference: "Cuenta / CLABE / IBAN",
    referencePlaceholder: "0000 0000 0000 0000",
    bank: true,
    routing: "SWIFT / Routing",
    routingPlaceholder: "BCOLCOBM",
  },
  paypal: {
    reference: "Correo de PayPal",
    referencePlaceholder: "creador@correo.com",
    bank: false,
    routing: null,
    routingPlaceholder: "",
  },
  wise: {
    reference: "Correo o etiqueta de Wise",
    referencePlaceholder: "creador@correo.com",
    bank: false,
    routing: null,
    routingPlaceholder: "",
  },
  binance: {
    reference: "Pay ID, correo o billetera",
    referencePlaceholder: "123456789",
    bank: false,
    routing: "Red",
    routingPlaceholder: "TRC20, BEP20…",
  },
  deel: {
    reference: "Correo de la cuenta Deel",
    referencePlaceholder: "creador@correo.com",
    bank: false,
    routing: null,
    routingPlaceholder: "",
  },
  efectivo: {
    reference: "Referencia de entrega",
    referencePlaceholder: "Quién entrega y dónde",
    bank: false,
    routing: null,
    routingPlaceholder: "",
  },
};

/**
 * Contactos que se piden a menudo y no tienen campo propio. Son sugerencias
 * para el editor: la etiqueta se puede escribir a mano igual.
 */
export const CONTACT_FIELD_SUGGESTIONS = [
  "Discord",
  "Telegram",
  "WhatsApp",
  "X / Twitter",
  "Correo del mánager",
  "Skype",
] as const;

export const COMPANY_STATUS: Record<string, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "ok" },
  prospecto: { label: "Prospecto", tone: "info" },
  inactivo: { label: "Inactivo", tone: "neutral" },
};

/**
 * Categorías de partida. El catálogo real vive en la base y se edita desde
 * Configuración; esto es solo con lo que se siembra la primera vez.
 */
export const CATEGORIAS_INICIALES = [
  "Tecnología",
  "Gaming",
  "Lifestyle",
  "Belleza",
  "Fitness",
  "Finanzas",
  "Educación",
  "Entretenimiento",
  "Automotriz",
  "Cocina",
];

export const INDUSTRIES = [
  "Software B2B",
  "Consumo masivo",
  "Fintech",
  "Belleza",
  "Moda",
  "Gaming",
  "Educación",
  "Salud",
  "Automotriz",
  "Otro",
];

export const CURRENCIES = ["USD", "MXN", "COP", "EUR"] as const;

export const SESSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  abierta: { label: "Abierta", tone: "ok" },
  cerrada: { label: "Cerrada", tone: "neutral" },
};

export const PORTAL_ROLE: Record<string, string> = {
  creador: "Creador",
  cliente: "Cliente",
  invitado: "Invitado",
};

export const SESSION_ITEM_KIND: Record<string, { label: string; tone: Tone }> = {
  entregable: { label: "Entregable", tone: "accent" },
  guion: { label: "Guion", tone: "info" },
  borrador: { label: "Borrador", tone: "warn" },
  referencia: { label: "Referencia", tone: "neutral" },
  nota: { label: "Nota", tone: "neutral" },
};
