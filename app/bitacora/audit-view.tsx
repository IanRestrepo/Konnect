"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { auditLabel } from "@/lib/audit";
import type { AuditEntry } from "@/lib/types";

/** A qué apunta cada movimiento, y con qué tono se pinta. */
const ENTIDAD: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn"; href?: (id: string) => string }> = {
  campaign: { label: "Campaña", tone: "accent", href: (id) => `/campanas/${id}` },
  creator: { label: "Creador", tone: "warn", href: (id) => `/creadores/${id}` },
  session: { label: "Sesión", tone: "ok", href: (id) => `/sesiones/${id}` },
  deliverable: { label: "Entregable", tone: "neutral" },
};

type Filtro = "todo" | "campaign" | "deliverable" | "creator" | "session";

/**
 * Bitácora: quién hizo qué y cuándo.
 *
 * Se lee de arriba abajo como una conversación, no como una tabla: lo que se
 * busca aquí es una respuesta concreta —«¿quién cerró esta campaña?»— y para
 * eso pesa más el orden que la densidad.
 */
export function AuditView({
  entradas,
  actores,
}: {
  entradas: AuditEntry[];
  actores: { id: string; name: string }[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [query, setQuery] = useState("");

  const pestanas = useMemo(() => {
    const cuenta = (e: string) => entradas.filter((x) => x.entity === e).length;
    return [
      { id: "todo" as const, label: "Todo", count: entradas.length },
      { id: "campaign" as const, label: "Campañas", count: cuenta("campaign") },
      { id: "deliverable" as const, label: "Pagos", count: cuenta("deliverable") },
      { id: "creator" as const, label: "Creadores", count: cuenta("creator") },
      { id: "session" as const, label: "Sesiones", count: cuenta("session") },
    ];
  }, [entradas]);

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entradas.filter((e) => {
      if (filtro !== "todo" && e.entity !== filtro) return false;
      if (!q) return true;
      return `${e.actorName} ${e.entityLabel} ${e.detail} ${auditLabel(e.action)}`
        .toLowerCase()
        .includes(q);
    });
  }, [entradas, filtro, query]);

  // Agrupadas por día: sin eso, treinta líneas seguidas no dicen cuándo pasó
  // cada cosa sin leer treinta fechas.
  const porDia = useMemo(() => {
    const grupos = new Map<string, AuditEntry[]>();
    for (const e of visibles) {
      const dia = e.createdAt.slice(0, 10);
      const lista = grupos.get(dia) ?? [];
      lista.push(e);
      grupos.set(dia, lista);
    }
    return [...grupos.entries()];
  }, [visibles]);

  return (
    <div className="space-y-7">
      <PageTitle
        title="Bitácora"
        description="Movimientos de campañas, sesiones y dinero. Lo que cambia el estado de algo, no cada clic."
      />

      <Toolbar>
        <Segmented options={pestanas} value={filtro} onChange={setFiltro} />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por persona, campaña o detalle"
          className="ml-auto"
        />
      </Toolbar>

      {visibles.length === 0 ? (
        <EmptyState
          icon={History}
          title={entradas.length === 0 ? "Todavía no hay movimientos" : "Nada con ese filtro"}
          description={
            entradas.length === 0
              ? "En cuanto alguien cierre una campaña o marque un pago, aparecerá aquí."
              : "Prueba con otra pestaña o limpia la búsqueda."
          }
        />
      ) : (
        <div className="space-y-6">
          {porDia.map(([dia, lista]) => (
            <section key={dia}>
              <p className="eyebrow mb-2">{fechaLarga(dia)}</p>
              <Card>
                <div className="divide-y divide-[var(--line)]">
                  {lista.map((e) => {
                    const tipo = ENTIDAD[e.entity] ?? { label: e.entity, tone: "neutral" as const };
                    const href = tipo.href?.(e.entityId);
                    const nombre =
                      actores.find((a) => a.id === e.actorId)?.name ?? e.actorName;

                    return (
                      <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                        <Avatar name={nombre} size={28} muted />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">
                            <span className="font-medium">{nombre}</span>{" "}
                            <span className="text-[var(--text-muted)]">
                              {auditLabel(e.action).toLowerCase()}
                            </span>
                            {e.entityLabel && (
                              <>
                                {" "}
                                {href ? (
                                  <Link
                                    href={href}
                                    className="font-medium hover:text-[var(--accent)]"
                                  >
                                    {e.entityLabel}
                                  </Link>
                                ) : (
                                  <span className="font-medium">{e.entityLabel}</span>
                                )}
                              </>
                            )}
                          </p>
                          {e.detail && (
                            <p className="mt-0.5 text-[12px] text-[var(--text-subtle)]">
                              {e.detail}
                            </p>
                          )}
                        </div>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={tipo.tone} plain>
                            {tipo.label}
                          </Badge>
                          <span className="tabular w-11 text-right text-[12px] text-[var(--text-subtle)]">
                            {hora(e.createdAt)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** «hoy» y «ayer» se leen más rápido que la fecha, que es lo que se busca. */
function fechaLarga(dia: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dia === hoy) return "Hoy";
  if (dia === ayer) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dia}T12:00:00`));
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}
