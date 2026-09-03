"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 *
 * La lista se dibuja sobre el documento y no dentro del campo. Las tarjetas
 * llevan `overflow-hidden` para respetar su radio, así que una lista absoluta
 * dentro de una tarjeta se corta por abajo por mucho `z-index` que tenga —y
 * eso pasaba en la mitad de los formularios—. Colocarla contra la posición
 * real del disparador es lo único que lo arregla en todos los sitios a la vez.
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
  /** Dónde y con qué ancho se pinta la lista, medida contra el disparador. */
  const [sitio, setSitio] = useState<{ top: number; left: number; width: number } | null>(null);

  const elegido = options.find((o) => o.id === value);

  /** Abre dejando marcada la opción actual, para no empezar siempre arriba. */
  function abrir() {
    setMarcado(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      // La lista ya no cuelga del campo, así que hay que preguntarle a las
      // dos: sin esto, el `mousedown` sobre una opción contaba como clic
      // fuera, cerraba la lista y el clic se perdía sin elegir nada.
      const dentro =
        caja.current?.contains(e.target as Node) || lista.current?.contains(e.target as Node);
      if (!dentro) setOpen(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [open]);

  /**
   * Coloca la lista contra la posición real del campo en pantalla. Se mide en
   * `useLayoutEffect` para no pintar un fotograma descolocado, y se vuelve a
   * medir al desplazar o redimensionar: como vive fuera del campo, no lo sigue
   * sola.
   */
  useLayoutEffect(() => {
    if (!open || !caja.current) return;

    function medir() {
      const t = caja.current?.getBoundingClientRect();
      if (!t) return;

      const margen = 8;
      const alto = lista.current?.getBoundingClientRect().height ?? 0;

      // Si no cabe debajo pero sí encima, se voltea; es lo que pasa con los
      // campos del final de un formulario largo.
      const cabeDebajo = t.bottom + 6 + alto <= window.innerHeight - margen;
      const cabeEncima = t.top - 6 - alto >= margen;
      const top = cabeDebajo || !cabeEncima ? t.bottom + 6 : t.top - alto - 6;

      setSitio({ top, left: t.left, width: t.width });
    }

    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [open, options.length]);

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

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={lista}
            id={listaId}
            role="listbox"
            // `fixed` y no `absolute`: al vivir fuera del campo, se posiciona
            // contra la ventana con las medidas que tomó `medir`.
            style={{
              top: sitio?.top ?? -9999,
              left: sitio?.left ?? -9999,
              width: sitio?.width,
            }}
            className="animate-layer fixed z-[100] max-h-64 overflow-y-auto rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
