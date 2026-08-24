"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--solid)] text-[var(--solid-fg)] hover:opacity-90",
  accent: "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110",
  secondary:
    "border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]",
  ghost: "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  danger: "border border-[var(--line)] text-[var(--danger)] hover:bg-[var(--danger-soft)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-[var(--r-chip)] px-3 text-[12.5px]",
  md: "h-9 gap-2 rounded-[var(--r-control)] px-3.5 text-[13px]",
  lg: "h-10 gap-2 rounded-[var(--r-control)] px-4 text-[13.5px]",
  icon: "h-9 w-9 justify-center rounded-[var(--r-control)]",
  "icon-lg": "h-10 w-10 justify-center rounded-[var(--r-control)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center font-medium whitespace-nowrap transition outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
