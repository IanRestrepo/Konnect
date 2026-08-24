"use client";

import { cn } from "@/lib/utils";

/** Tooltip por CSS: sin estado ni portales. */
export function Tooltip({
  label,
  side = "right",
  children,
  className,
}: {
  label: string;
  side?: "right" | "top";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 rounded-[var(--r-chip)] bg-[var(--solid)] px-2.5 py-1.5 text-[12px] leading-none font-medium whitespace-nowrap text-[var(--solid-fg)] opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-100 group-hover/tt:opacity-100",
          side === "right"
            ? "top-1/2 left-full ml-2 -translate-y-1/2"
            : "bottom-full left-1/2 mb-2 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
