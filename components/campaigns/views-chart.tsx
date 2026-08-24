"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { formatCompact } from "@/lib/utils";

export type ChartPoint = { label: string; vistas: number; tipo: string };

export function ViewsChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">
        Sin entregables publicados todavía.
      </p>
    );
  }

  return (
    <div className="h-56 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-subtle)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-subtle)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCompact(v)}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", radius: 8 }}
            content={<ChartTooltip labels={{ vistas: "Vistas" }} format={formatCompact} />}
          />
          <Bar dataKey="vistas" radius={[6, 6, 0, 0]} maxBarSize={52}>
            {data.map((point, index) => (
              <Cell
                key={point.label + index}
                fill={
                  point.tipo === "short"
                    ? "color-mix(in oklab, var(--accent) 45%, transparent)"
                    : "var(--accent)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
