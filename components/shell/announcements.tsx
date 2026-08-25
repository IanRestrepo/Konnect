"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { Announcement, AnnouncementTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTILO: Record<AnnouncementTone, { icon: LucideIcon; clase: string }> = {
  info: { icon: Info, clase: "bg-[var(--info-soft)] text-[var(--info)]" },
  ok: { icon: CircleCheck, clase: "bg-[var(--ok-soft)] text-[var(--ok)]" },
  warn: { icon: TriangleAlert, clase: "bg-[var(--warn-soft)] text-[var(--warn)]" },
  danger: { icon: CircleAlert, clase: "bg-[var(--danger-soft)] text-[var(--danger)]" },
};

/**
 * Avisos que publica el desarrollador. Los que se pueden cerrar se recuerdan
 * en el navegador de cada quien; los que no, siguen ahí hasta que se apaguen.
 */
export function Announcements({ items }: { items: Announcement[] }) {
  const [cerrados, setCerrados] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("konnect.avisos") ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  function cerrar(id: string) {
    const next = [...cerrados, id];
    setCerrados(next);
    try {
      localStorage.setItem("konnect.avisos", JSON.stringify(next));
    } catch {
      // Sin almacenamiento el aviso reaparecerá; no es motivo para romper nada.
    }
  }

  const visibles = items.filter((a) => !cerrados.includes(a.id));
  if (!visibles.length) return null;

  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6 md:px-8">
      {visibles.map((a) => {
        const { icon: Icono, clase } = ESTILO[a.tone];
        return (
          <div
            key={a.id}
            role="status"
            className={cn(
              "flex items-start gap-2.5 rounded-[var(--r-control)] px-3.5 py-2.5 text-[13px]",
              clase,
            )}
          >
            <Icono size={15} className="mt-px shrink-0" />
            <p className="min-w-0 flex-1 leading-relaxed">{a.message}</p>
            {a.dismissible && (
              <button
                onClick={() => cerrar(a.id)}
                aria-label="Cerrar aviso"
                className="-mt-0.5 -mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-chip)] opacity-70 transition hover:opacity-100"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
