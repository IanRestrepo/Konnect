export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-MX").format(n);
}

export function formatCompact(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/**
 * Una métrica de audiencia, o una raya si no se sabe.
 *
 * Fuera de YouTube no hay de dónde leer los seguidores: un cero ahí no es
 * «tiene cero», es «nadie lo ha apuntado», y enseñarlo como dato hace quedar
 * mal al creador y a la herramienta.
 */
export function formatAudiencia(n: number | null | undefined) {
  return n ? formatCompact(n) : "—";
}

/**
 * Lee una cantidad como la escriben las redes: «353.1K», «4,2 M», «12 mil»,
 * «1.400.000». Con sufijo, el punto o la coma son decimales; sin sufijo, son
 * separadores de miles. Lo que no se entiende vale cero.
 */
export function parseCantidad(texto: string): number {
  const t = texto.trim().toLowerCase().replace(/\s/g, "");
  const m = t.match(/^([\d.,]+)(k|mil|m|mm|millones|b)?$/);
  if (!m) return 0;
  const sufijo = m[2];
  if (!sufijo) return parseInt(m[1]!.replace(/[.,]/g, ""), 10) || 0;
  const valor = parseFloat(m[1]!.replace(",", "."));
  if (!Number.isFinite(valor)) return 0;
  const por = sufijo === "k" || sufijo === "mil" ? 1e3 : sufijo === "b" ? 1e9 : 1e6;
  return Math.round(valor * por);
}

export function formatMoney(n: number | null | undefined, currency = "USD") {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
