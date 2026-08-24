"use client";

import { cn } from "@/lib/utils";

/** Interruptor de dos estados. Se controla desde fuera. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  busy = false,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Atenúa mientras se guarda, sin bloquear el clic siguiente. */
  busy?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-[var(--r-pill)] transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none",
        checked ? "bg-[var(--ok)]" : "bg-[var(--line-strong)]",
        disabled && "cursor-not-allowed opacity-40",
        busy && "opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[16px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
