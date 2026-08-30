"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Popover({
  trigger,
  children,
  align = "start",
  side = "right",
  className,
  portal = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  /**
   * Dibuja el panel sobre el documento en vez de dentro del disparador.
   *
   * Hace falta cuando algún ancestro recorta —una lista con esquinas
   * redondeadas usa `overflow-hidden`— porque ahí un panel absoluto se corta
   * por mucho `z-index` que lleve.
   */
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const dentro =
        ref.current?.contains(e.target as Node) || panel.current?.contains(e.target as Node);
      if (!dentro) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Coloca el panel contra la posición real del disparador en pantalla.
   * Se mide en `useLayoutEffect` para no pintar un fotograma descolocado.
   */
  useLayoutEffect(() => {
    if (!portal || !open || !ref.current) return;

    function medir() {
      const t = ref.current?.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      if (!t) return;

      const ancho = p?.width ?? 224;
      const alto = p?.height ?? 0;
      const margen = 8;

      let top = side === "top" ? t.top - alto - 6 : t.bottom + 6;
      let left = align === "end" ? t.right - ancho : align === "center" ? t.left + t.width / 2 - ancho / 2 : t.left;

      // Si no cabe abajo, se voltea arriba; y nunca se sale por los lados.
      if (top + alto > window.innerHeight - margen && t.top - alto - 6 > margen) {
        top = t.top - alto - 6;
      }
      left = Math.min(Math.max(margen, left), window.innerWidth - ancho - margen);

      setCaja({ top, left });
    }

    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [portal, open, side, align]);

  const position = {
    top: "bottom-full mb-1.5",
    bottom: "top-full mt-1.5",
    right: "left-full ml-1.5 top-0",
    left: "right-full mr-1.5 top-0",
  }[side];

  const alignment =
    side === "top" || side === "bottom"
      ? { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" }[align]
      : { start: "top-0", center: "top-1/2 -translate-y-1/2", end: "bottom-0 top-auto" }[align];

  const contenido = children({ close: () => setOpen(false) });

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open &&
        (portal ? (
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={panel}
              style={{ top: caja?.top ?? -9999, left: caja?.left ?? -9999 }}
              className={cn(
                "animate-layer fixed z-[100] min-w-56 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]",
                className,
              )}
            >
              {contenido}
            </div>,
            document.body,
          )
        ) : (
          <div
            className={cn(
              "animate-layer absolute z-50 min-w-56 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]",
              position,
              alignment,
              className,
            )}
          >
            {contenido}
          </div>
        ))}
    </div>
  );
}
