import { cn } from "@/lib/utils";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--surface-3)] text-[var(--text-muted)]",
  ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
  warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "bg-[var(--info-soft)] text-[var(--info)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
};

/** Pastilla de estado: punto de color y texto. Sin iconos decorativos. */
export function Badge({
  tone = "neutral",
  plain = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; plain?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1 text-[12px] leading-none font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {!plain && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
