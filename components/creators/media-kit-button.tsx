"use client";

import { FileDown, FileText, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";

/**
 * Genera el media kit del creador con BlackBull Engine.
 *
 * Dos versiones porque se mandan en momentos distintos: la de presentación va
 * antes de hablar de dinero, y la de tarifas cuando el cliente ya pregunta
 * cuánto cuesta. Se abre en otra pestaña, en el visor del navegador, que es
 * desde donde se descarga o se comparte.
 */
export function MediaKitButton({ creatorId }: { creatorId: string }) {
  const base = `/api/creadores/${creatorId}/media-kit`;

  return (
    <Popover
      side="bottom"
      align="end"
      portal
      trigger={({ toggle }) => (
        <Button variant="secondary" size="lg" onClick={toggle}>
          <FileDown size={16} />
          Media kit
        </Button>
      )}
    >
      {({ close }) => (
        <div className="w-64 p-1">
          <a
            href={base}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="flex w-full items-start gap-2.5 rounded-[var(--r-chip)] px-2.5 py-2 text-left transition hover:bg-[var(--surface-3)]"
          >
            <FileText size={15} className="mt-0.5 shrink-0" />
            <span>
              <span className="block text-[13px]">Media kit</span>
              <span className="block text-[12px] text-[var(--text-muted)]">
                Métricas, canales, marcas y portafolio
              </span>
            </span>
          </a>
          <a
            href={`${base}?tarifas=1`}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="flex w-full items-start gap-2.5 rounded-[var(--r-chip)] px-2.5 py-2 text-left transition hover:bg-[var(--surface-3)]"
          >
            <Tags size={15} className="mt-0.5 shrink-0" />
            <span>
              <span className="block text-[13px]">Media kit con tarifas</span>
              <span className="block text-[12px] text-[var(--text-muted)]">
                Lo mismo, más el precio por pieza al cliente
              </span>
            </span>
          </a>
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-[var(--text-subtle)]">
            Generado con BlackBull Engine
          </p>
        </div>
      )}
    </Popover>
  );
}
