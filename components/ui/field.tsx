"use client";

import { cn } from "@/lib/utils";

/**
 * Campos de formulario. El foco se marca con un halo del color de acento
 * además del borde: sin él, un campo enfocado y uno en reposo se distinguen
 * apenas, que es lo que hace que un formulario parezca sin terminar.
 */
const base =
  "w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 text-[13.5px] text-[var(--text)] " +
  "placeholder:text-[var(--text-subtle)] outline-none transition-[border-color,box-shadow,background-color] " +
  "hover:border-[var(--line-strong)] " +
  "focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:shadow-[0_0_0_3px_var(--accent-soft)] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[12.5px] font-medium tracking-[0.01em] text-[var(--text-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // Sin agarradera de redimensionado: crecía en diagonal y se veía descuidado.
  return <textarea className={cn(base, "min-h-18 resize-none py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(base, "h-10 cursor-pointer appearance-none pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23948a86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-[12px] text-[var(--text-subtle)]", className)} {...props} />;
}

/**
 * Campo con icono dentro. Para enlaces y búsquedas, donde el icono dice de
 * qué se trata sin gastar una etiqueta.
 */
export function InputWithIcon({
  icon,
  className,
  wrapperClassName,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ReactNode;
  wrapperClassName?: string;
}) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-subtle)]">
        {icon}
      </span>
      <input className={cn(base, "h-10 pl-9.5", className)} {...props} />
    </div>
  );
}

/** Etiqueta, control y pista en un solo bloque, con separación uniforme. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}
