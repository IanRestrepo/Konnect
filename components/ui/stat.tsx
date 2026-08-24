import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

export function StatBand({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)} {...props} />;
}

/**
 * Tarjeta de métrica: etiqueta, cifra, variación y tendencia a la derecha.
 * La serie es opcional: si no hay histórico real, la tarjeta va sin gráfica
 * antes que inventarse una.
 */
export function Stat({
  label,
  value,
  hint,
  delta,
  series,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  series?: number[];
  className?: string;
}) {
  const positive = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        "rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3.5",
        className,
      )}
    >
      <p className="text-[12.5px] text-[var(--text-muted)]">{label}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="tabular text-[23px] leading-none font-semibold tracking-[-0.035em]">
              {value}
            </p>
            {delta !== undefined && (
              <span
                className={cn(
                  "tabular inline-flex items-center gap-0.5 text-[12px] font-medium",
                  positive ? "text-[var(--ok)]" : "text-[var(--danger)]",
                )}
              >
                {positive ? (
                  <ArrowUpRight size={13} strokeWidth={2.25} />
                ) : (
                  <ArrowDownRight size={13} strokeWidth={2.25} />
                )}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
          {hint && (
            <p className="mt-1.5 truncate text-[12px] text-[var(--text-subtle)]">{hint}</p>
          )}
        </div>

        {series && series.length > 1 && (
          <Sparkline data={series} tone={delta === undefined ? "accent" : "auto"} />
        )}
      </div>
    </div>
  );
}
