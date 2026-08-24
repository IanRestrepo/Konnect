"use client";

import { cn } from "@/lib/utils";

type Datum = {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
};

/**
 * Tooltip propio para las gráficas: recharts trae uno con separador " : ",
 * tipografía del sistema y colores que no siguen el tema. Este usa los tokens.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
  labels,
  className,
}: {
  active?: boolean;
  payload?: Datum[];
  label?: string | number;
  /** Formatea el valor de cada serie. */
  format?: (value: number) => string;
  /** Renombra las series: { ingresos: "Ingresos" }. */
  labels?: Record<string, string>;
  className?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "min-w-32 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-pop)]",
        className,
      )}
    >
      {label !== undefined && (
        <p className="mb-1.5 text-[12.5px] font-medium text-[var(--text)]">{label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const name = labels?.[key] ?? String(item.name ?? key);
          const raw = Number(item.value ?? 0);
          return (
            <li key={key} className="flex items-center gap-2 text-[12px] whitespace-nowrap">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: item.color ?? "var(--accent)" }}
              />
              <span className="text-[var(--text-muted)]">{name}</span>
              <span className="tabular ml-auto font-medium text-[var(--text)]">
                {format ? format(raw) : raw.toLocaleString("es-MX")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
