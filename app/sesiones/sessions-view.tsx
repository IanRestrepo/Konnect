"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Layers, Trash2 } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Paginador, usePagina } from "@/components/ui/pager";
import { useRecordado } from "@/lib/recordar";
import { useCan } from "@/components/session-provider";
import { CAMPAIGN_STATUS } from "@/lib/labels";
import type { CampaignStatus, CollabSession } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type CampanaResumen = { id: string; name: string; status: CampaignStatus };
type Filtro = "revisar" | "todas";

/**
 * Las sesiones, agrupadas por campaña.
 *
 * Ya no se crean desde aquí: una sesión es la de un creador en una campaña y
 * nace sola al contratarlo. Esta pantalla es el atajo para llegar a la sesión
 * maestra de cada campaña sin pasar por Campañas. Van por orden de creación;
 * lo que tiene entregas esperando respuesta se ve con el filtro «Por revisar».
 */
export function SessionsView({
  sessions,
  campaigns,
}: {
  sessions: CollabSession[];
  campaigns: CampanaResumen[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_sesiones");

  // Recordados: al volver de una sesión la lista sigue como la dejaste.
  const [query, setQuery] = useRecordado("sesiones.busqueda", "");
  const [filtro, setFiltro] = useRecordado<Filtro>("sesiones.filtro", "todas");
  const [error, setError] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const porCampana = new Map<string, CollabSession[]>();
    for (const s of sessions) {
      if (!s.campaignId) continue;
      porCampana.set(s.campaignId, [...(porCampana.get(s.campaignId) ?? []), s]);
    }
    return campaigns
      .filter((c) => porCampana.has(c.id))
      .map((c) => {
        const suyas = porCampana.get(c.id)!;
        const reqs = suyas.flatMap((s) => s.requirements);
        const abiertas = reqs.filter((r) => r.status !== "aprobado");
        return {
          campaign: c,
          sesiones: suyas.length,
          creada: suyas.map((s) => s.createdAt).sort().at(-1) ?? "",
          porRevisar: reqs.filter((r) => r.status === "enviado").length,
          pendientes: abiertas.length,
          proxima: abiertas
            .map((r) => r.dueDate)
            .filter((d): d is string => Boolean(d))
            .sort()[0],
        };
      })
      // Por creación, lo más reciente arriba. Ordenar por lo que hay que revisar
      // hacía saltar las campañas de sitio cada vez que llegaba una entrega;
      // para eso está el filtro «Por revisar».
      .sort((a, b) => b.creada.localeCompare(a.creada));
  }, [sessions, campaigns]);

  /** Sesiones de antes de que no pudiera haberlas sin campaña. */
  const sueltas = useMemo(() => sessions.filter((s) => !s.campaignId), [sessions]);

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grupos.filter((g) => {
      if (filtro === "revisar" && g.porRevisar === 0) return false;
      return !q || g.campaign.name.toLowerCase().includes(q);
    });
  }, [grupos, query, filtro]);

  const pagina = usePagina(visibles, `${filtro}|${query}`, undefined, "sesiones");

  async function borrarSuelta(s: CollabSession) {
    if (!window.confirm(`¿Eliminar la sesión «${s.name}»? Se borra con su material y sus accesos.`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/sesiones/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "No se pudo eliminar la sesión.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Sesiones"
        description="Cada campaña tiene su sesión maestra con las de todos sus creadores. Se abren solas al contratar."
      />

      <Toolbar>
        <Segmented
          options={[
            { id: "todas", label: "Todas", count: grupos.length },
            {
              id: "revisar",
              label: "Por revisar",
              count: grupos.filter((g) => g.porRevisar > 0).length,
            },
          ]}
          value={filtro}
          onChange={setFiltro}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar campaña…" />
      </Toolbar>

      {error && (
        <p className="rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          {error}
        </p>
      )}

      {visibles.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={grupos.length === 0 ? "Todavía no hay sesiones" : "Sin resultados"}
          description={
            grupos.length === 0
              ? "Contrata a un creador en una campaña y su sesión aparecerá aquí."
              : filtro === "revisar"
                ? "Nada esperando revisión."
                : "Prueba con otro nombre."
          }
        />
      ) : (
        <>
          <ListBox>
            {pagina.visibles.map((g) => {
              const estado = CAMPAIGN_STATUS[g.campaign.status];
              return (
                <ListRow
                  key={g.campaign.id}
                  href={`/campanas/${g.campaign.id}/sesion`}
                  leading={
                    <RowIcon>
                      <Layers size={17} strokeWidth={1.75} />
                    </RowIcon>
                  }
                  title={g.campaign.name}
                  subtitle={[
                    `${g.sesiones} sesi${g.sesiones === 1 ? "ón" : "ones"}`,
                    g.pendientes ? `${g.pendientes} por resolver` : "todo aprobado",
                    g.proxima ? `próxima el ${formatDate(g.proxima)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={
                    <span className="flex items-center gap-2">
                      {g.porRevisar > 0 && <Badge tone="accent">{g.porRevisar} por revisar</Badge>}
                      <Badge tone={estado.tone}>{estado.label}</Badge>
                    </span>
                  }
                />
              );
            })}
          </ListBox>
          <Paginador {...pagina} />
        </>
      )}

      {sueltas.length > 0 && (
        <section>
          <SectionLabel>Sueltas, de antes</SectionLabel>
          <p className="mb-2.5 text-[12.5px] text-[var(--text-muted)]">
            Sesiones creadas antes de que toda sesión tuviera que ser de una campaña. Siguen
            funcionando, pero ya no se pueden mover a otra campaña.
          </p>
          <ListBox>
            {sueltas.map((s) => (
              <ListRow
                key={s.id}
                chevron={false}
                leading={
                  <RowIcon>
                    <FolderKanban size={17} strokeWidth={1.75} />
                  </RowIcon>
                }
                // El nombre es el enlace y no la fila: la fila lleva el botón
                // de borrar, y un botón dentro de un enlace se porta mal.
                title={
                  <Link href={`/sesiones/${s.id}`} className="transition hover:text-[var(--accent)]">
                    {s.name}
                  </Link>
                }
                subtitle={`${s.requirements.length} peticiones · ${s.items.length} elementos · ${formatDate(s.createdAt)}`}
                trailing={
                  puedeEditar ? (
                    <button
                      onClick={() => void borrarSuelta(s)}
                      aria-label={`Eliminar ${s.name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : undefined
                }
              />
            ))}
          </ListBox>
        </section>
      )}
    </div>
  );
}
