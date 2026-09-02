"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { CONTACT_FIELD_SUGGESTIONS } from "@/lib/labels";
import type { ContactField } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Fila nueva, con la etiqueta ya puesta si vino de una sugerencia. */
function campoVacio(label = ""): ContactField {
  return { id: "", label, value: "" };
}

/**
 * Contactos que no tienen campo propio en la ficha: Discord, Telegram, el
 * correo del mánager…
 *
 * La etiqueta se escribe a mano a propósito. Fijar una lista cerrada obligaba
 * a tocar el código cada vez que aparece una red nueva por la que se le habla
 * a un creador; las sugerencias son sólo un atajo para las de siempre.
 */
export function ContactFieldsEditor({
  fields,
  onChange,
  className,
}: {
  fields: ContactField[];
  onChange: (fields: ContactField[]) => void;
  className?: string;
}) {
  function cambiar(i: number, patch: Partial<ContactField>) {
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  // Sólo se ofrecen las que aún no están puestas.
  const sugerencias = CONTACT_FIELD_SUGGESTIONS.filter(
    (s) => !fields.some((f) => f.label.trim().toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <Label>Otros contactos</Label>
        {fields.length === 0 && (
          <FieldHint className="mt-0 mb-2">
            Discord, Telegram o lo que haga falta. Tú le pones el nombre.
          </FieldHint>
        )}
      </div>

      {fields.map((campo, i) => (
        <div key={campo.id || `nuevo-${i}`} className="flex gap-2">
          <Input
            value={campo.label}
            onChange={(e) => cambiar(i, { label: e.target.value })}
            placeholder="Discord"
            aria-label="Nombre del campo"
            className="w-36 shrink-0"
          />
          <Input
            value={campo.value}
            onChange={(e) => cambiar(i, { value: e.target.value })}
            placeholder="usuario#0000"
            aria-label="Valor"
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
            aria-label="Quitar contacto"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => onChange([...fields, campoVacio()])}>
          <Plus size={13} />
          Añadir campo
        </Button>
        {sugerencias.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange([...fields, campoVacio(s)])}
            className="h-8 rounded-[var(--r-pill)] border border-dashed border-[var(--line)] px-3 text-[12.5px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
