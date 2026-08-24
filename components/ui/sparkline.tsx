import { cn } from "@/lib/utils";

/**
 * Mini gráfica de tendencia para las tarjetas de métricas.
 * SVG a mano: pesa nada y no arrastra recharts a cada tarjeta.
 */
export function Sparkline({
  data,
  width = 64,
  height = 26,
  tone = "accent",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  /** `auto` pinta verde si sube y rojo si baja. */
  tone?: "accent" | "auto" | "muted";
  className?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (data.length - 1);

  const points = data.map((value, index) => {
    const x = pad + index * stepX;
    // Serie plana: línea centrada en vez de pegada al borde.
    const ratio = max === min ? 0.5 : (value - min) / span;
    const y = height - pad - ratio * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(2)} ${height} L${points[0][0].toFixed(2)} ${height} Z`;

  const rising = data[data.length - 1] >= data[0];
  const color =
    tone === "muted"
      ? "var(--text-subtle)"
      : tone === "auto"
        ? rising
          ? "var(--ok)"
          : "var(--danger)"
        : "var(--accent)";

  const gradientId = `spark-${line.length}-${Math.round(data[0])}-${Math.round(max)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
