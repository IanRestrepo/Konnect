"use client";

import { Building2, UserRound } from "lucide-react";
import { Label } from "@/components/ui/field";
import type { CompanyKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIPOS: { id: CompanyKind; label: string; icono: typeof Building2 }[] = [
  { id: "empresa", label: "Empresa", icono: Building2 },
  { id: "persona", label: "Persona natural", icono: UserRound },
];

/**
 * Empresa o persona natural.
 *
 * Una persona que contrata a su nombre funciona igual que una empresa —tiene
 * campañas y contactos—, pero darla de alta como empresa obligaba a
 * inventarle un sector y le ponía un logo cuadrado.
 */
export function CompanyKindField({
  value,
  onChange,
}: {
  value: CompanyKind;
  onChange: (kind: CompanyKind) => void;
}) {
  return (
    <div>
      <Label>Tipo de cliente</Label>
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => {
          const Icono = t.icono;
          const activo = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(t.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                activo
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              <Icono size={13} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
