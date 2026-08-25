"use client";

import { useEffect } from "react";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  footer,
  footerNote,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Ancla visual de la cabecera: dice de qué va el diálogo antes de leerlo. */
  icon?: LucideIcon;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Texto a la izquierda de los botones: atajos, avisos, contadores. */
  footerNote?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-3xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 py-6 sm:p-8">
      <div
        className="animate-veil fixed inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-layer relative z-10 my-auto w-full overflow-hidden rounded-[var(--r-panel)]",
          "border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)]",
          width,
        )}
      >
        {(title || description) && (
          <div className="flex items-start gap-3.5 px-5 pt-5 pb-4">
            {Icon && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-control)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon size={17} strokeWidth={1.75} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-[16px] leading-tight font-semibold tracking-[-0.015em]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="-mt-1 -mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {children && (
          <div className="max-h-[min(70dvh,40rem)] overflow-y-auto border-t border-[var(--line)] px-5 py-5">
            {children}
          </div>
        )}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-3.5">
            {footerNote && (
              <p className="mr-auto text-[12px] text-[var(--text-subtle)]">{footerNote}</p>
            )}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
