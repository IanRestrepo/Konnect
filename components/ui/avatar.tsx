/* eslint-disable @next/next/no-img-element */
import { cn, initials } from "@/lib/utils";

export function Avatar({
  src,
  name,
  size = 32,
  className,
  rounded = "full",
  muted = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  /** `full` para personas, `lg` (redondeado) para empresas. */
  rounded?: "full" | "lg";
  muted?: boolean;
}) {
  const radius = rounded === "full" ? "rounded-full" : "rounded-[var(--r-control)]";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn(radius, "shrink-0 border border-[var(--line)] object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        radius,
        "inline-flex shrink-0 items-center justify-center border border-[var(--line)] font-medium",
        muted
          ? "bg-[var(--surface-2)] text-[var(--text-subtle)]"
          : "bg-[var(--surface-3)] text-[var(--text-muted)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
