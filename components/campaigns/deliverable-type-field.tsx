"use client";

import { useState } from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { TAREAS } from "@/lib/socials";
import { DELIVERABLE_TYPE } from "@/lib/labels";
import type { DeliverableKind, DeliverableType, SocialPlatform } from "@/lib/types";

/** Las cinco familias de fábrica, para decir de cuál cuelga un tipo propio. */
const FAMILIAS = Object.entries(DELIVERABLE_TYPE) as [DeliverableType, string][];

const ESTANDAR = "std:";
const PROPIO = "propio:";

/**
 * Qué se le encarga al creador, con creación de tipos en el sitio.
 *
 * Ofrece dos cosas en la misma lista: las tareas que esa red admite de fábrica
 * —«Video dedicado», «Reel», «Mención durante el directo»— y los tipos que la
 * agencia se haya inventado. Se eligen igual porque para quien pacta la pieza
 * son lo mismo; la diferencia es interna.
 *
 * Un tipo propio cuelga siempre de una de las cinco familias, y esa familia es
 * la que decide qué tarifa del creador se propone: sin ella, un «Unboxing»
 * nacería a cero y habría que teclear el precio a mano cada vez.
 */
export function DeliverableTypeField({
  id,
  platform,
  type,
  customType,
  kinds,
  onChange,
  onKindsChange,
  label = "Qué se le encarga",
}: {
  id: string;
  platform: SocialPlatform;
  type: DeliverableType;
  /** Nombre propio elegido. Vacío = una de las tareas de fábrica. */
  customType: string;
  kinds: DeliverableKind[];
  onChange: (type: DeliverableType, customType: string) => void;
  /** El catálogo vive arriba: al crear uno, el padre se entera. */
  onKindsChange: (kinds: DeliverableKind[]) => void;
  label?: string;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [familia, setFamilia] = useState<DeliverableType>(type);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tareas = TAREAS[platform] ?? [];

  // Un tipo propio que se borró del catálogo no puede desaparecer de la pieza
  // que ya lo tenía: se sigue ofreciendo mientras esté elegido.
  const huerfano =
    customType && !kinds.some((k) => k.name.toLowerCase() === customType.toLowerCase());

  const opciones = [
    ...tareas.map((t) => ({ id: `${ESTANDAR}${t.type}`, label: t.label })),
    ...(huerfano ? [{ id: `${PROPIO}${customType}`, label: customType, hint: "Ya no en catálogo" }] : []),
    ...kinds.map((k) => ({
      id: `${PROPIO}${k.name}`,
      label: k.name,
      hint: DELIVERABLE_TYPE[k.baseType],
    })),
  ];

  const valor = customType ? `${PROPIO}${customType}` : `${ESTANDAR}${type}`;

  function elegir(llave: string) {
    if (llave.startsWith(PROPIO)) {
      const nombreElegido = llave.slice(PROPIO.length);
      const kind = kinds.find((k) => k.name === nombreElegido);
      onChange(kind?.baseType ?? type, nombreElegido);
      return;
    }
    onChange(llave.slice(ESTANDAR.length) as DeliverableType, "");
  }

  function abrirCreacion() {
    setNombre("");
    setFamilia(type);
    setError(null);
    setCreando(true);
  }

  function cerrar() {
    setCreando(false);
    setNombre("");
    setError(null);
  }

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio) return;

    // Si ya está, no se llama al servidor: se elige y ya.
    const existente = kinds.find((k) => k.name.toLowerCase() === limpio.toLowerCase());
    if (existente) {
      onChange(existente.baseType, existente.name);
      cerrar();
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/tipos-pieza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: limpio, baseType: familia }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el tipo de pieza.");
      onKindsChange(data.kinds as DeliverableKind[]);
      onChange(familia, limpio);
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div>
        <Label htmlFor={`${id}-nuevo`}>Nuevo tipo de pieza</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-nuevo`}
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
            placeholder="Unboxing, Podcast, Newsletter…"
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={crear}
            disabled={guardando || !nombre.trim()}
            aria-label="Guardar tipo de pieza"
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

        <div className="mt-2">
          <Label htmlFor={`${id}-familia`}>Cobra como</Label>
          <Picker
            id={`${id}-familia`}
            value={familia}
            onChange={setFamilia}
            options={FAMILIAS.map(([valorFamilia, etiqueta]) => ({
              id: valorFamilia,
              label: etiqueta,
            }))}
          />
        </div>

        {error ? (
          <FieldHint className="text-[var(--danger)]">{error}</FieldHint>
        ) : (
          <FieldHint>
            De ahí sale el precio que se propone. Se añade al catálogo y queda elegido.
          </FieldHint>
        )}
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Picker
          id={id}
          value={valor}
          onChange={elegir}
          options={opciones}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={abrirCreacion}
          aria-label="Crear un tipo de pieza"
          title="Crear un tipo de pieza"
          className="grid h-10 w-9 shrink-0 place-items-center rounded-[var(--r-control)] border border-[var(--line)] text-[var(--text-subtle)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
