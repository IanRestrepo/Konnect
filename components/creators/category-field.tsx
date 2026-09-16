"use client";

import { useState } from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";

/** Valor del desplegable mientras no se ha elegido nada que añadir. */
const NINGUNA = "";

/**
 * Categorías del creador: varias, con creación en el sitio.
 *
 * Eran una sola, y elegir otra pisaba la anterior: un creador de Roblox tenía
 * que dejar de ser de Gaming para serlo. Ahora se van añadiendo, y la primera
 * es la principal, la que agrupa la lista de creadores.
 *
 * El catálogo se administra en Configuración, pero mandar allí a quien está a
 * medias de dar de alta a un creador —y perder el formulario por el camino—
 * es la razón por la que nadie crearía una categoría nueva nunca. Aquí se
 * escribe, se guarda en el catálogo y queda añadida.
 *
 * Usa \`Picker\` y no el \`<select>\` nativo: la lista abierta del nativo la
 * pinta el sistema operativo, con el azul de Chrome.
 */
export function CategoryField({
  id,
  values,
  onChange,
  categories,
  onCategoriesChange,
}: {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  categories: string[];
  /** El catálogo vive arriba: al crear una, el padre se entera. */
  onCategoriesChange: (categories: string[]) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiene = (c: string) => values.some((v) => v.toLowerCase() === c.toLowerCase());
  const disponibles = categories.filter((c) => !tiene(c));

  function añadir(categoria: string) {
    if (!categoria || tiene(categoria)) return;
    onChange([...values, categoria]);
  }

  function quitar(categoria: string) {
    onChange(values.filter((v) => v !== categoria));
  }

  /** Pasa una categoría al principio: la principal es la primera. */
  function hacerPrincipal(categoria: string) {
    onChange([categoria, ...values.filter((v) => v !== categoria)]);
  }

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio) return;

    // Si ya está en el catálogo, no se llama al servidor: se añade y ya.
    const existente = categories.find((c) => c.toLowerCase() === limpio.toLowerCase());
    if (existente) {
      añadir(existente);
      cerrar();
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: limpio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la categoría.");
      onCategoriesChange(data.categories as string[]);
      añadir(limpio);
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    setCreando(false);
    setNombre("");
    setError(null);
  }

  return (
    <div>
      <Label htmlFor={id}>Categorías</Label>

      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((c, i) => (
            <span
              key={c}
              className={
                i === 0
                  ? "inline-flex h-7 items-center gap-1 rounded-[var(--r-pill)] border border-transparent bg-[var(--accent-soft)] pr-1 pl-2.5 text-[12.5px] font-medium text-[var(--accent)]"
                  : "inline-flex h-7 items-center gap-1 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] pr-1 pl-2.5 text-[12.5px]"
              }
            >
              {i === 0 ? (
                c
              ) : (
                <button
                  type="button"
                  onClick={() => hacerPrincipal(c)}
                  title="Hacerla principal"
                  className="transition hover:text-[var(--accent)]"
                >
                  {c}
                </button>
              )}
              <button
                type="button"
                onClick={() => quitar(c)}
                aria-label={`Quitar ${c}`}
                className="grid h-5 w-5 place-items-center rounded-full text-current opacity-60 transition hover:opacity-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {creando ? (
        <div className="flex gap-2">
          <Input
            id={`${id}-nueva`}
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void crear();
              }
              if (e.key === "Escape") cerrar();
            }}
            placeholder="Cocina, Motor, ASMR…"
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={crear}
            disabled={guardando || !nombre.trim()}
            aria-label="Guardar categoría"
            className="grid h-10 w-9 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-40"
          >
            {guardando ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={15} />}
          </button>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cancelar"
            className="grid h-10 w-9 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Picker
            id={id}
            value={NINGUNA}
            onChange={añadir}
            placeholder={disponibles.length ? "Añadir categoría…" : "Ya tiene todas"}
            disabled={disponibles.length === 0}
            options={disponibles.map((c) => ({ id: c, label: c }))}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => setCreando(true)}
            aria-label="Crear una categoría"
            title="Crear una categoría"
            className="grid h-10 w-9 shrink-0 place-items-center rounded-[var(--r-control)] border border-[var(--line)] text-[var(--text-subtle)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
          >
            <Plus size={15} />
          </button>
        </div>
      )}

      {error ? (
        <FieldHint className="text-[var(--danger)]">{error}</FieldHint>
      ) : (
        <FieldHint>
          {values.length > 1
            ? "La primera es la principal. Pulsa otra para hacerla principal."
            : "Puede tener varias."}
        </FieldHint>
      )}
    </div>
  );
}
