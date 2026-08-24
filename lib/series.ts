import type { Campaign } from "@/lib/types";

/**
 * Series mensuales para las mini gráficas de las tarjetas.
 *
 * Todo sale de fechas que ya tenemos: publicación de entregables e inicio/fin
 * de campañas. Cuando exista `MetricSnapshot` en la base, la evolución de
 * vistas vendrá de ahí y será exacta día a día; mientras tanto, cada pieza
 * cuenta en el mes en que se publicó.
 */

const MONTHS = 6;

/** Últimos `MONTHS` meses como claves `2026-08`, terminando en el mes actual. */
function monthKeys(reference = new Date()): string[] {
  const keys: string[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function keyOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Convierte un mapa mes→valor en la serie ordenada, rellenando huecos con 0. */
function toSeries(buckets: Map<string, number>, cumulative = false): number[] {
  let running = 0;
  return monthKeys().map((key) => {
    const value = buckets.get(key) ?? 0;
    if (!cumulative) return value;
    running += value;
    return running;
  });
}

/** Vistas acumuladas mes a mes, según cuándo se publicó cada pieza. */
export function viewsSeries(campaigns: Campaign[]): number[] {
  const buckets = new Map<string, number>();
  campaigns.forEach((campaign) => {
    campaign.deliverables.forEach((d) => {
      if (!d.publishedAt || !d.views) return;
      const key = keyOf(d.publishedAt);
      buckets.set(key, (buckets.get(key) ?? 0) + d.views);
    });
  });
  return toSeries(buckets, true);
}

/** Interacciones (likes + comentarios) acumuladas mes a mes. */
export function engagementSeries(campaigns: Campaign[]): number[] {
  const buckets = new Map<string, number>();
  campaigns.forEach((campaign) => {
    campaign.deliverables.forEach((d) => {
      if (!d.publishedAt) return;
      const total = (d.likes ?? 0) + (d.comments ?? 0);
      if (!total) return;
      const key = keyOf(d.publishedAt);
      buckets.set(key, (buckets.get(key) ?? 0) + total);
    });
  });
  return toSeries(buckets, true);
}

/** Campañas vivas en cada mes: empezaron antes del corte y no habían terminado. */
export function activeCampaignsSeries(campaigns: Campaign[]): number[] {
  return monthKeys().map((key) => {
    const [year, month] = key.split("-").map(Number);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    return campaigns.filter((c) => {
      const start = new Date(c.startDate);
      if (start > monthEnd) return false;
      if (!c.endDate) return true;
      return new Date(c.endDate) >= new Date(year, month - 1, 1);
    }).length;
  });
}

/** Presupuesto comprometido acumulado, por mes de arranque de la campaña. */
export function budgetSeries(campaigns: Campaign[]): number[] {
  const buckets = new Map<string, number>();
  campaigns.forEach((campaign) => {
    const key = keyOf(campaign.startDate);
    buckets.set(key, (buckets.get(key) ?? 0) + campaign.budget);
  });
  return toSeries(buckets, true);
}

/** Vistas mensuales (no acumuladas) de un solo creador. */
export function creatorViewsSeries(campaigns: Campaign[], creatorId: string): number[] {
  const buckets = new Map<string, number>();
  campaigns.forEach((campaign) => {
    campaign.deliverables
      .filter((d) => d.creatorId === creatorId && d.publishedAt && d.views)
      .forEach((d) => {
        const key = keyOf(d.publishedAt as string);
        buckets.set(key, (buckets.get(key) ?? 0) + (d.views ?? 0));
      });
  });
  return toSeries(buckets, true);
}

/** Inversión acumulada de una empresa, por mes de arranque de sus campañas. */
export function companyInvestmentSeries(campaigns: Campaign[]): number[] {
  return budgetSeries(campaigns);
}

/**
 * Variación entre el primer y el último punto con datos. `null` cuando no hay
 * base de comparación, para no mostrar un porcentaje inventado.
 */
export function trend(series: number[]): number | null {
  const firstNonZero = series.findIndex((v) => v > 0);
  if (firstNonZero === -1 || firstNonZero === series.length - 1) return null;
  const base = series[firstNonZero];
  const last = series[series.length - 1];
  if (!base) return null;
  return ((last - base) / base) * 100;
}
