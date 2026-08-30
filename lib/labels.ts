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
};

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

export const COMPANY_STATUS: Record<string, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "ok" },
  prospecto: { label: "Prospecto", tone: "info" },
  inactivo: { label: "Inactivo", tone: "neutral" },
};

/** Listas de los desplegables. Compartidas entre el alta y la edición. */
export const CATEGORIES = [
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
