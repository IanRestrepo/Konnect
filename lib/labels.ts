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

export const DELIVERABLE_TYPE: Record<DeliverableType, string> = {
  video: "Video dedicado",
  short: "Reel / Short",
  integracion: "Fracción publicitaria",
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
