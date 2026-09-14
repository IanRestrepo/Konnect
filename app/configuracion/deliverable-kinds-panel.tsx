"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { DELIVERABLE_TYPE } from "@/lib/labels";
import type { DeliverableKind, DeliverableType } from "@/lib/types";

const FAMILIAS = Object.entries(DELIVERABLE_TYPE) as [DeliverableType, string][];

/**
 * Catálogo de tipos de pieza propios de la agencia.
 *
 * Los cinco formatos de fábrica —video, vertical corto, mención, directo y
 * publicación— no se editan: son los que entienden las tarifas del creador y
 * los informes. Lo que se edita aquí son los nombres que la agencia les pone
 * encima: un «Unboxing» que cobra como video dedicado, un «Podcast» que cobra
 * como directo.
 *
 * Quitar uno de aquí no toca las piezas que ya lo usaban, igual que con las
 * categorías: deja de ofrecerse al pactar, y la pieza vieja sigue llamándose
 * como se llamaba. Se dice en pantalla porque la expectativa es la contraria.
 */
export function DeliverableKindsPanel() {
  const router = useRouter();
  const [lista, setLista] = useState<DeliverableKind[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/configuracion/tipos-pieza")
      .then((r) => r.json())
      .then((d) => vivo && setLista(d.kinds ?? []))
      .catch(() => vivo && setError("No se pudo leer el catálogo."));
    return () => {
      vivo = false;
    };
  }, []);

  function cambiar(i: number, patch: Partial<DeliverableKind>) {
    setLista((prev) => prev && prev.map((k, j) => (j === i ? { ...k, ...patch } : k)));
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
    const limpia = lista
      .map((k) => ({ name: k.name.trim(), baseType: k.baseType }))
      .filter((k) => k.name);

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/tipos-pieza", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kinds: limpia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el catálogo.");
      setLista(data.kinds as DeliverableKind[]);
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
        <CardTitle>Tipos de pieza</CardTitle>
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
            {lista.length === 0 && (
              <p className="text-[12.5px] text-[var(--text-muted)]">
                Todavía no hay tipos propios. Los de fábrica —video dedicado, reel, mención,
                directo y publicación— siguen ofreciéndose siempre.
              </p>
            )}

            {lista.map((kind, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={kind.name}
                  onChange={(e) => cambiar(i, { name: e.target.value })}
                  placeholder="Unboxing, Podcast, Newsletter…"
                  aria-label={`Tipo de pieza ${i + 1}`}
                  className="min-w-0 flex-1"
                />
                <Picker
                  value={kind.baseType}
                  onChange={(baseType) => cambiar(i, { baseType })}
                  options={FAMILIAS.map(([id, label]) => ({ id, label }))}
                  className="w-[190px] shrink-0"
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
                    aria-label="Quitar tipo de pieza"
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
                setLista((prev) => [
                  ...(prev ?? []),
                  { id: "", name: "", baseType: "video" as DeliverableType },
                ]);
                setGuardado(false);
              }}
            >
              <Plus size={14} />
              Añadir tipo
            </Button>

            <FieldHint>
              La columna de la derecha dice de qué formato cobra: de ahí sale el precio que se
              propone al pactar la pieza. Quitar un tipo no cambia las piezas que ya lo tienen.
            </FieldHint>
          </>
        )}
      </div>
    </Card>
  );
}
