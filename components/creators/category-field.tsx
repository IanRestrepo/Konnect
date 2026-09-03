"use client";

import { useState } from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";

/**
 * Categoría del creador, con creación en el sitio.
 *
 * El catálogo se administra en Configuración, pero mandar allí a quien está a
 * medias de dar de alta a un creador —y perder el formulario por el camino—
 * es la razón por la que nadie crearía una categoría nueva nunca. Aquí se
 * escribe, se guarda en el catálogo y queda elegida.
 */
export function CategoryField({
  id,
  value,
  onChange,
  categories,
  onCategoriesChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  /** El catálogo vive arriba: al crear una, el padre se entera. */
  onCategoriesChange: (categories: string[]) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Una categoría vieja que ya no esté en el catálogo no debe perderse.
  const opciones = categories.includes(value) || !value ? categories : [value, ...categories];

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio) return;

    // Si ya está, no se llama al servidor: se elige y ya.
    const existente = categories.find((c) => c.toLowerCase() === limpio.toLowerCase());
    if (existente) {
      onChange(existente);
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
      onChange(limpio);
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

  if (creando) {
    return (
      <div>
        <Label htmlFor={`${id}-nueva`}>Nueva categoría</Label>
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
            {guardando ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
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
        {error ? (
          <FieldHint className="text-[var(--danger)]">{error}</FieldHint>
        ) : (
          <FieldHint>Se añade al catálogo y queda elegida.</FieldHint>
        )}
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id}>Categoría</Label>
      <div className="flex gap-2">
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        >
          {opciones.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
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
    </div>
  );
}
