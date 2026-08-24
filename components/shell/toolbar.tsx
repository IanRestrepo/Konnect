"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-48 flex-1 sm:max-w-64", className)}>
      <Search
        size={14}
        className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-subtle)]"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] pr-3 pl-8.5 text-[13px] outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--line-strong)]"
      />
    </div>
  );
}

/** Filtros: pastillas redondeadas, la activa en sólido tenue. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "h-7 rounded-[var(--r-chip)] px-2.5 text-[12.5px] transition",
              active
                ? "bg-[var(--surface)] font-medium text-[var(--text)] shadow-[var(--shadow-soft)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="tabular ml-1.5 text-[var(--text-subtle)]">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
