"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
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

  const width = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl", xl: "max-w-3xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 pb-24 sm:p-10 sm:pb-10">
      <div className="animate-veil fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-layer relative z-10 w-full rounded-[var(--r-panel)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-pop)]",
          width,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
            <div>
              {title && <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="-mt-0.5 -mr-1 rounded-[var(--r-control)] p-1 text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
              aria-label="Cerrar"
            >
              <X size={15} />
            </button>
          </div>
        )}
        {children && <div className="px-5 py-5">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
