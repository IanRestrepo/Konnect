"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cuántos influencers se enseñan de una vez en cualquier lista. */
export const POR_PAGINA = 10;

/**
 * Parte una lista en páginas.
 *
 * `clave` es lo que define la lista —la búsqueda, el filtro, la red—: cuando
 * cambia, se vuelve a la primera página. Se compara en el render en vez de
 * resetear con un efecto, porque con el efecto se pinta un fotograma con la
 * página vieja sobre la lista nueva, que puede estar vacía.
 */
export function usePagina<T>(items: T[], clave: string, porPagina = POR_PAGINA) {
  const [estado, setEstado] = useState({ clave, pagina: 0 });

  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  const pedida = estado.clave === clave ? estado.pagina : 0;
  // Si la lista encoge —se quitó a alguien— no se queda en una página que ya
  // no existe.
  const pagina = Math.min(pedida, paginas - 1);

  return {
    visibles: items.slice(pagina * porPagina, (pagina + 1) * porPagina),
    pagina,
    paginas,
    total: items.length,
    desde: items.length === 0 ? 0 : pagina * porPagina + 1,
    hasta: Math.min((pagina + 1) * porPagina, items.length),
    ir: (n: number) => setEstado({ clave, pagina: Math.min(Math.max(n, 0), paginas - 1) }),
  };
}

/** Anterior / siguiente, con el tramo que se está viendo. */
export function Paginador({
  pagina,
  paginas,
  total,
  desde,
  hasta,
  ir,
  className,
}: ReturnType<typeof usePagina> & { className?: string }) {
  // Con una sola página no hay nada que navegar: la barra solo ocuparía sitio.
  if (paginas <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-[12.5px] text-[var(--text-muted)]",
        className,
      )}
    >
      <span className="tabular">
        {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => ir(pagina - 1)}
          disabled={pagina === 0}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--r-control)] border border-[var(--line)] px-2.5 transition hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
        <span className="tabular px-2">
          {pagina + 1} / {paginas}
        </span>
        <button
          type="button"
          onClick={() => ir(pagina + 1)}
          disabled={pagina >= paginas - 1}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--r-control)] border border-[var(--line)] px-2.5 transition hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
        >
          Siguiente
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
