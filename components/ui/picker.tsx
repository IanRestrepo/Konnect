"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Desplegable propio.
 *
 * Un `<select>` nativo se puede estilizar cerrado, pero la lista abierta la
 * dibuja el sistema operativo: de ahí el azul de Chrome que no encaja con
 * nada. Esto la pinta con los tokens de la aplicación.
 *
 * Mantiene lo que el nativo hace bien: se abre con Enter o flechas, se navega
 * con el teclado, se cierra con Escape y al hacer clic fuera.
 */
export function Picker<T extends string>({
  value,
  onChange,
  options,
  id,
  placeholder = "Selecciona…",
  disabled,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; hint?: string }[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const listaId = useId();
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const elegido = options.find((o) => o.id === value);

  /** Abre dejando marcada la opción actual, para no empezar siempre arriba. */
  function abrir() {
    setMarcado(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [open]);

  // Mantiene a la vista la opción marcada al navegar con el teclado.
  useEffect(() => {
    if (!open || !lista.current) return;
    lista.current.children[marcado]?.scrollIntoView({ block: "nearest" });
  }, [marcado, open]);

  function teclado(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const opcion = options[marcado];
      if (opcion) {
        e.preventDefault();
        onChange(opcion.id);
        setOpen(false);
      }
    }
  }

  return (
    <div ref={caja} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : abrir())}
        onKeyDown={teclado}
        role="combobox"
        aria-expanded={open}
        aria-controls={listaId}
        aria-haspopup="listbox"
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] px-3 text-left text-[13.5px] transition",
          "focus:border-[var(--line-strong)] focus:outline-none",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:border-[var(--line-strong)]",
        )}
      >
        <span className={cn("truncate", !elegido && "text-[var(--text-subtle)]")}>
          {elegido?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 text-[var(--text-subtle)] transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          ref={lista}
          id={listaId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]"
        >
          {options.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-[12.5px] text-[var(--text-subtle)]">
              Nada que elegir
            </p>
          ) : (
            options.map((option, i) => {
              const activo = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={activo}
                  onMouseEnter={() => setMarcado(i)}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[var(--r-chip)] px-2.5 py-2 text-left text-[13px] transition",
                    i === marcado ? "bg-[var(--surface-3)]" : "bg-transparent",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-[12px] text-[var(--text-subtle)]">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {activo && <Check size={14} className="shrink-0 text-[var(--accent)]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
