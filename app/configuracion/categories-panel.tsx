"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input } from "@/components/ui/field";

/**
 * Catálogo de categorías de creador.
 *
 * Quitar una de aquí no toca las fichas que ya la usaban: la categoría se
 * guarda como texto en el creador, así que deja de ofrecerse al clasificar
 * pero la ficha vieja sigue enseñando la suya. Eso se dice en pantalla, porque
 * la expectativa natural es la contraria.
 */
export function CategoriesPanel() {
  const router = useRouter();
  const [lista, setLista] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/configuracion/categorias")
      .then((r) => r.json())
      .then((d) => vivo && setLista(d.categories ?? []))
      .catch(() => vivo && setError("No se pudo leer el catálogo."));
    return () => {
      vivo = false;
    };
  }, []);

  function cambiar(i: number, valor: string) {
    setLista((prev) => prev && prev.map((c, j) => (j === i ? valor : c)));
    setGuardado(false);
  }

  function mover(i: number, delta: number) {
    setLista((prev) => {
      if (!prev) return prev;
      const destino = i + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[destino]] = [copia[destino]!, copia[i]!];
      return copia;
    });
    setGuardado(false);
  }

  async function guardar() {
    if (!lista) return;
    const limpia = lista.map((c) => c.trim()).filter(Boolean);
    if (limpia.length === 0) {
      setError("Deja al menos una categoría.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/categorias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: limpia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el catálogo.");
      setLista(data.categories as string[]);
      setGuardado(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorías de creador</CardTitle>
        {lista && (
          <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
            {guardando && <LoaderCircle size={13} className="animate-spin" />}
            {guardado && !guardando ? "Guardado" : "Guardar"}
          </Button>
        )}
      </CardHeader>

      {error && (
        <p className="mx-5 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <div className="space-y-2 border-t border-[var(--line)] p-5">
        {lista === null ? (
          <p className="text-[12.5px] text-[var(--text-muted)]">Cargando…</p>
        ) : (
          <>
            {lista.map((categoria, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={categoria}
                  onChange={(e) => cambiar(i, e.target.value)}
                  placeholder="Nombre de la categoría"
                  aria-label={`Categoría ${i + 1}`}
                  className="min-w-0 flex-1"
                />
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                    className="grid h-10 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === lista.length - 1}
                    aria-label="Bajar"
                    className="grid h-10 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLista((prev) => prev && prev.filter((_, j) => j !== i));
                      setGuardado(false);
                    }}
                    aria-label="Quitar categoría"
                    className="grid h-10 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLista((prev) => [...(prev ?? []), ""]);
                setGuardado(false);
              }}
            >
              <Plus size={14} />
              Añadir categoría
            </Button>

            <FieldHint>
              Quitar una de aquí no cambia las fichas que ya la tienen: deja de ofrecerse al
              clasificar, pero el creador conserva la suya hasta que alguien se la cambie.
            </FieldHint>
          </>
        )}
      </div>
    </Card>
  );
}
