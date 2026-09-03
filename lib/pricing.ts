import type {
  Campaign,
  Creator,
  CreatorRate,
  Deliverable,
  DeliverableType,
  SocialPlatform,
} from "@/lib/types";

/**
 * Precios de una campaña.
 *
 * El número base es lo que paga el cliente por cada pieza. De ahí la agencia
 * se queda una comisión —en porcentaje o en cantidad fija— y el creador
 * recibe el resto. Los tres números siempre cuadran:
 *
 *     cobro al cliente = comisión de la agencia + pago al creador
 *
 * No hay presupuesto de campaña que repartir: cada pieza se pacta por
 * separado (ABO). El `budget` de la campaña, si existe, es solo un tope de
 * referencia contra el que comparar.
 */

/**
 * Importe máximo que admite la base: las columnas son `Decimal(12, 2)`, o sea
 * diez dígitos enteros. Pasarse hace fallar la inserción con un error de
 * Postgres que no le dice nada a quien está rellenando el formulario.
 */
export const IMPORTE_MAXIMO = 9_999_999_999.99;

/** Comisión de la agencia sobre una pieza, en dinero. */
export function agencyCut(deliverable: Deliverable, campaign: Campaign): number {
  if (deliverable.commissionFixed !== null) {
    // Nunca más que el total: una comisión mayor dejaría al creador en negativo.
    return Math.min(deliverable.commissionFixed, deliverable.clientPrice);
  }
  const pct = deliverable.commissionPct ?? campaign.agencyFee ?? 0;
  return deliverable.clientPrice * (Math.min(Math.max(pct, 0), 100) / 100);
}

/** Lo que le queda al creador después de la comisión. */
export function creatorPayout(deliverable: Deliverable, campaign: Campaign): number {
  return deliverable.clientPrice - agencyCut(deliverable, campaign);
}

/** Los cancelados no cuentan: ni se pagan ni se facturan. */
function billable(campaign: Campaign): Deliverable[] {
  return campaign.deliverables.filter((d) => d.status !== "cancelado");
}

export type CampaignTotals = {
  /** Suma de lo que se le factura al cliente. */
  clientTotal: number;
  /** Suma de lo que reciben los creadores. */
  creatorTotal: number;
  /** Lo que se queda la agencia: `clientTotal - creatorTotal`. */
  grossProfit: number;
  /** Comisión media efectiva, en porcentaje. Null si no hay nada pactado. */
  marginPct: number | null;
  /** Cuánto del tope de referencia se ha comprometido. Null si no hay tope. */
  budgetUsedPct: number | null;
  paidToCreators: number;
  pendingToCreators: number;
};

export function campaignTotals(campaign: Campaign): CampaignTotals {
  const piezas = billable(campaign);

  const clientTotal = piezas.reduce((s, d) => s + d.clientPrice, 0);
  const creatorTotal = piezas.reduce((s, d) => s + creatorPayout(d, campaign), 0);
  const paidToCreators = piezas
    .filter((d) => d.paymentStatus === "pagado")
    .reduce((s, d) => s + creatorPayout(d, campaign), 0);

  return {
    clientTotal,
    creatorTotal,
    grossProfit: clientTotal - creatorTotal,
    marginPct: clientTotal > 0 ? ((clientTotal - creatorTotal) / clientTotal) * 100 : null,
    budgetUsedPct:
      campaign.budget && campaign.budget > 0 ? (clientTotal / campaign.budget) * 100 : null,
    paidToCreators,
    pendingToCreators: creatorTotal - paidToCreators,
  };
}

/* ---------------- Tarifas del creador ---------------- */

/**
 * Lo que cobra un creador por un tipo de pieza en una plataforma.
 *
 * Es lo que el creador quiere recibir, no lo que se le cobra al cliente: al
 * armar la campaña sirve para proponer un precio de partida.
 *
 * Si no hay tarifa para esa red, cae en las tarifas antiguas, que no
 * distinguen plataforma, para que las fichas de antes sigan sirviendo.
 */
export function rateFor(
  creator: Pick<Creator, "rates" | "rateVideo" | "rateShort" | "rateIntegration">,
  platform: SocialPlatform,
  type: DeliverableType,
  /** Canal secundario concreto. Vacío = su canal principal. */
  channelId = "",
): number {
  // Tres escalones: la tarifa de ese canal, la de la red, y las antiguas. Un
  // canal secundario suele cobrar menos que el principal, pero si nadie le
  // puso precio propio lo justo es cobrar el de la red, no cero.
  if (channelId) {
    const delCanal = creator.rates?.find(
      (r) => r.platform === platform && r.type === type && r.channelId === channelId,
    );
    if (delCanal) return delCanal.amount;
  }

  const exacta = creator.rates?.find(
    (r) => r.platform === platform && r.type === type && !r.channelId,
  );
  if (exacta) return exacta.amount;

  // Las tarifas antiguas solo cubrían tres formatos. Los nuevos —directo,
  // publicación— no tienen respaldo: se cargan por red o quedan sin precio.
  const heredada: Partial<Record<DeliverableType, number>> = {
    video: creator.rateVideo,
    short: creator.rateShort,
    integracion: creator.rateIntegration,
  };
  return heredada[type] ?? 0;
}

/** Si el precio sale de una tarifa propia de esa red o de la de respaldo. */
export function hasRateFor(
  creator: Pick<Creator, "rates">,
  platform: SocialPlatform,
  type: DeliverableType,
  channelId = "",
): boolean {
  return Boolean(
    creator.rates?.some(
      (r) =>
        r.platform === platform &&
        r.type === type &&
        (r.channelId === channelId || !r.channelId),
    ),
  );
}

/**
 * Precio de partida al cliente para que al creador le quede su tarifa.
 *
 * Si el creador pide 1.000 y la agencia se lleva el 20%, hay que cobrar 1.250,
 * no 1.200: el porcentaje se aplica sobre el total, no sobre el pago.
 */
export function clientPriceForRate(rate: number, commissionPct: number): number {
  const pct = Math.min(Math.max(commissionPct, 0), 99);
  return rate / (1 - pct / 100);
}

/** Plataformas para las que el creador tiene al menos una tarifa cargada. */
export function pricedPlatforms(rates: CreatorRate[]): SocialPlatform[] {
  return [...new Set(rates.filter((r) => r.amount > 0).map((r) => r.platform))];
}
