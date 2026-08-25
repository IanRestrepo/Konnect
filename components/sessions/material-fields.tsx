"use client";

import { FileText, Link2, Lightbulb, PenLine, StickyNote, type LucideIcon } from "lucide-react";
import { InputWithIcon, Input, Label, Textarea } from "@/components/ui/field";
import { SESSION_ITEM_KIND } from "@/lib/labels";
import type { SessionItemKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MaterialDraft = {
  kind: SessionItemKind;
  title: string;
  url: string;
  notes: string;
};

export const MATERIAL_VACIO: MaterialDraft = {
  kind: "entregable",
  title: "",
  url: "",
  notes: "",
};

const ICONO: Record<SessionItemKind, LucideIcon> = {
  entregable: Link2,
  guion: PenLine,
  borrador: FileText,
  referencia: Lightbulb,
  nota: StickyNote,
};

/** Cada tipo pinta con su propio color, el mismo que después lleva su etiqueta. */
const TONO: Record<SessionItemKind, string> = {
  entregable: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
  guion: "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]",
  borrador: "border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)]",
  referencia: "border-[var(--line-strong)] bg-[var(--surface-3)] text-[var(--text)]",
  nota: "border-[var(--line-strong)] bg-[var(--surface-3)] text-[var(--text)]",
};

const TIPOS = Object.keys(SESSION_ITEM_KIND) as SessionItemKind[];

const PLACEHOLDER: Record<SessionItemKind, { title: string; url: string }> = {
  entregable: { title: "Corte final del video", url: "https://youtube.com/watch?v=…" },
  guion: { title: "Guion v2", url: "https://docs.google.com/…" },
  borrador: { title: "Primer corte", url: "https://drive.google.com/…" },
  referencia: { title: "Referencia de tono", url: "https://…" },
  nota: { title: "Cambios pedidos por el cliente", url: "" },
};

/**
 * Campos para compartir material. Los usan el panel de la agencia y el portal
 * externo, así que el creador ve exactamente el mismo formulario que nosotros.
 */
export function MaterialFields({
  value,
  onChange,
}: {
  value: MaterialDraft;
  onChange: (next: MaterialDraft) => void;
}) {
  const ejemplo = PLACEHOLDER[value.kind];
  const esNota = value.kind === "nota";

  return (
    <div className="space-y-4">
      <div>
        <Label>Tipo</Label>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((id) => {
            const Icono = ICONO[id];
            const activo = id === value.kind;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...value, kind: id })}
                aria-pressed={activo}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                  activo
                    ? TONO[id]
                    : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]",
                )}
              >
                <Icono size={13} strokeWidth={2} />
                {SESSION_ITEM_KIND[id].label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="mat-title">Título</Label>
        <Input
          id="mat-title"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder={ejemplo.title}
          autoFocus
        />
      </div>

      {/* Una nota se explica sola: no tiene enlace que compartir. */}
      {!esNota && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <Label htmlFor="mat-url" className="mb-0">
              Enlace
            </Label>
            <span className="text-[11.5px] text-[var(--text-subtle)]">Drive, YouTube, Frame.io…</span>
          </div>
          <InputWithIcon
            id="mat-url"
            icon={<Link2 size={14} />}
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            placeholder={ejemplo.url}
            inputMode="url"
          />
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <Label htmlFor="mat-notes" className="mb-0">
            {esNota ? "Contenido" : "Notas"}
          </Label>
          {!esNota && <span className="text-[11.5px] text-[var(--text-subtle)]">Opcional</span>}
        </div>
        <Textarea
          id="mat-notes"
          rows={esNota ? 4 : 2}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder={esNota ? "Escribe la nota…" : "Qué mirar, qué falta, en qué quedaron…"}
        />
      </div>
    </div>
  );
}
