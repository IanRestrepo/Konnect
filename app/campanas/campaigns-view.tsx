"use client";

import { useMemo } from "react";
import { useRecordado } from "@/lib/recordar";
import { Paginador, usePagina } from "@/components/ui/pager";
import Link from "next/link";
import { Download, Megaphone, Plus, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { ListBox, ListRow } from "@/components/ui/list";
import { CampaignSwitch } from "@/components/campaigns/campaign-switch";
import { CAMPAIGN_OBJECTIVE, CAMPAIGN_STATUS } from "@/lib/labels";
import type { Campaign, CampaignMetrics, CampaignStatus, Company, Creator } from "@/lib/types";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";

type Persona = { id: string; name: string; avatarUrl: string | null };

export type CampaignRow = {
  campaign: Campaign;
  metrics: CampaignMetrics;
  company: Company | null;
  creators: Creator[];
  /** Quien la lleva. */
  manager: Persona | null;
  /** Quien la creó. */
  createdBy: Persona | null;
};

type Filter = "activas" | "finalizadas" | "inactivas" | "borradores" | "todas";

/**
 * Qué estados entran en cada pestaña.
 *
 * Las finalizadas van aparte: son las que se repasan para cobrar y para ver
 * qué salió bien, y mezcladas con las pausadas y canceladas había que
 * buscarlas. Pausada y cancelada siguen juntas en «Inactivas».
 */
const ESTADOS: Record<Exclude<Filter, "todas">, CampaignStatus[]> = {
  activas: ["activa"],
  finalizadas: ["finalizada"],
  inactivas: ["pausada", "cancelada"],
  borradores: ["borrador"],
};

/** El encargado, y quién la creó si es otra persona. */
function Encargado({ manager, createdBy }: { manager: Persona | null; createdBy: Persona | null }) {
  const quien = manager ?? createdBy;
  if (!quien) return <span className="text-[var(--text-subtle)]">—</span>;
  const otro = manager && createdBy && createdBy.id !== manager.id ? createdBy : null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={quien.avatarUrl} name={quien.name} size={26} />
      <span className="min-w-0">
        <span className="block max-w-36 truncate text-[13px]">{quien.name}</span>
        <span className="block max-w-36 truncate text-[11.5px] text-[var(--text-subtle)]">
          {manager ? (otro ? `Creada por ${otro.name}` : "Encargado") : "Creador · sin encargado"}
        </span>
      </span>
    </span>
  );
}

export function CampaignsView({ rows }: { rows: CampaignRow[] }) {
  // Recordados: al volver de una campaña la lista sigue como la dejaste.
  const [tab, setTab] = useRecordado<Filter>("campanas.filtro", "activas");
  const [query, setQuery] = useRecordado("campanas.busqueda", "");

  const tabs = useMemo<{ id: Filter; label: string; count: number }[]>(() => {
    const count = (filtro: Exclude<Filter, "todas">) =>
      rows.filter((r) => ESTADOS[filtro].includes(r.campaign.status)).length;
    return [
      { id: "activas", label: "Activas", count: count("activas") },
      { id: "finalizadas", label: "Finalizadas", count: count("finalizadas") },
      { id: "inactivas", label: "Inactivas", count: count("inactivas") },
      { id: "borradores", label: "Borradores", count: count("borradores") },
      { id: "todas", label: "Todas", count: rows.length },
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ campaign, company, manager }) => {
      if (tab !== "todas" && !ESTADOS[tab].includes(campaign.status)) return false;
      if (!q) return true;
      return `${campaign.name} ${company?.name ?? ""} ${manager?.name ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, tab, query]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, { metrics }) => ({
          budget: acc.budget + metrics.clientTotal,
          spent: acc.spent + metrics.spent,
          profit: acc.profit + metrics.grossProfit,
          views: acc.views + metrics.views,
        }),
        { budget: 0, spent: 0, profit: 0, views: 0 },
      ),
    [filtered],
  );

  const pagina = usePagina(filtered, `${tab}|${query}`, undefined, "campanas");

  function exportCsv() {
    downloadCsv(`konnect-campanas-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Campaña",
        "Cliente",
        "Encargado",
        "Estado",
        "Objetivo",
        "Creadores",
        "Vistas",
        "Interacciones",
        "CPM",
        "Comprometido",
        "Facturado",
        "Ganancia",
        "Moneda",
        "Inicio",
        "Fin",
      ],
      ...filtered.map(({ campaign, metrics, company, creators, manager }) => [
        campaign.name,
        company?.name ?? "",
        manager?.name ?? "",
        CAMPAIGN_STATUS[campaign.status].label,
        CAMPAIGN_OBJECTIVE[campaign.objective],
        creators.map((c) => c.name).join(", "),
        metrics.views,
        metrics.likes + metrics.comments,
        metrics.cpm ? metrics.cpm.toFixed(2) : "",
        metrics.spent,
        metrics.clientTotal,
        metrics.grossProfit,
        campaign.currency,
        campaign.startDate.slice(0, 10),
        campaign.endDate ? campaign.endDate.slice(0, 10) : "",
      ]),
    ]);
  }

  return (
    <div className="space-y-7">
      <PageTitle
        title="Campañas"
        description="Seguimiento del rendimiento por cliente y creador."
        actions={
          <>
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              aria-label="Exportar a CSV"
              title="Exportar a CSV"
            >
              <Download size={18} strokeWidth={1.75} />
            </Button>
            <Link href="/campanas/nueva">
              <Button variant="primary" size="lg">
                Crear campaña
                <Plus size={17} strokeWidth={2.25} />
              </Button>
            </Link>
          </>
        }
      />

      {/* Lo que dejan las campañas de la pestaña elegida: con «Finalizadas»
          es lo ganado, con «Activas» lo que está en marcha. */}
      {filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Facturado al cliente"
            value={formatMoney(totals.budget)}
            hint={`${filtered.length} campaña${filtered.length === 1 ? "" : "s"}`}
          />
          <Stat label="Pactado con creadores" value={formatMoney(totals.spent)} />
          <Stat
            label="Ganancia"
            value={formatMoney(totals.profit)}
            tone={totals.profit < 0 ? "danger" : "ok"}
            hint={
              totals.budget > 0
                ? `${((totals.profit / totals.budget) * 100).toFixed(0)}% de lo facturado`
                : undefined
            }
          />
        </div>
      )}

      <Toolbar>
        <Segmented options={tabs} value={tab} onChange={setTab} />
        <Button variant="secondary" size="md">
          <SlidersHorizontal size={15} />
          Filtros
        </Button>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar campaña o cliente"
          className="ml-auto"
        />
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin campañas"
          description="Crea una campaña para dar seguimiento a entregables y métricas."
          action={
            <Link href="/campanas/nueva">
              <Button variant="accent">
                <Plus size={16} />
                Crear campaña
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Teléfono y tablet: filas apiladas. La tabla pide 880px y no cabe. */}
          <ListBox className="lg:hidden">
            {pagina.visibles.map(({ campaign, metrics, company, creators, manager }) => {
              const status = CAMPAIGN_STATUS[campaign.status];
              return (
                <ListRow
                  key={campaign.id}
                  href={`/campanas/${campaign.id}`}
                  title={campaign.name}
                  subtitle={[
                    company?.name ?? "Sin cliente",
                    manager ? `lleva ${manager.name}` : null,
                    `${creators.length} creadores`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={
                    <span className="flex items-center gap-3">
                      <span className="flex flex-col items-end gap-1">
                        <span className="tabular text-[13px] font-semibold text-[var(--ok)]">
                          {formatMoney(metrics.grossProfit, campaign.currency)}
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                      <CampaignSwitch
                        campaignId={campaign.id}
                        campaignName={campaign.name}
                        status={campaign.status}
                      />
                    </span>
                  }
                />
              );
            })}
          </ListBox>

          <TableWrap className="hidden lg:block">
            <Table className="min-w-[1080px]">
            <thead>
              <tr>
                <Th className="w-12 pl-4" aria-label="Activa" />
                <Th>Campaña</Th>
                <Th>Encargado</Th>
                <Th>Creadores</Th>
                <Th>Estado</Th>
                <Th align="right">Vistas</Th>
                <Th align="right">CPM</Th>
                <Th align="right">Facturado</Th>
                <Th align="right">Ganancia</Th>
                <Th>Periodo</Th>
              </tr>
            </thead>
            <tbody>
              {pagina.visibles.map(({ campaign, metrics, company, creators, manager, createdBy }) => {
                const status = CAMPAIGN_STATUS[campaign.status];
                return (
                  <Tr key={campaign.id}>
                    <Td className="pl-4">
                      <CampaignSwitch
                        campaignId={campaign.id}
                        campaignName={campaign.name}
                        status={campaign.status}
                      />
                    </Td>
                    <Td>
                      <Link href={`/campanas/${campaign.id}`} className="block max-w-72">
                        <span className="block truncate text-[14px] font-semibold">
                          {campaign.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-[var(--text-muted)]">
                          {company?.name ?? "Sin cliente"} ·{" "}
                          {CAMPAIGN_OBJECTIVE[campaign.objective]}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <Encargado manager={manager} createdBy={createdBy} />
                    </Td>
                    <Td>
                      {creators.length === 0 ? (
                        <span className="text-[var(--text-subtle)]">—</span>
                      ) : (
                        <span className="flex -space-x-2">
                          {creators.slice(0, 4).map((creator) => (
                            <Avatar
                              key={creator.id}
                              src={creator.avatarUrl}
                              name={creator.name}
                              size={26}
                              className="ring-2 ring-[var(--surface)]"
                            />
                          ))}
                          {creators.length > 4 && (
                            <span className="tabular grid h-[26px] w-[26px] place-items-center rounded-full bg-[var(--surface-3)] text-[11px] font-medium ring-2 ring-[var(--surface)]">
                              +{creators.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>
                    <Td align="right" className="tabular text-[15px] font-semibold">
                      {formatCompact(metrics.views)}
                    </Td>
                    <Td align="right" className="tabular text-[var(--text-muted)]">
                      {metrics.cpm ? `$${metrics.cpm.toFixed(2)}` : "—"}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMoney(metrics.clientTotal, campaign.currency)}
                    </Td>
                    <Td
                      align="right"
                      className={
                        metrics.grossProfit < 0
                          ? "tabular font-semibold text-[var(--danger)]"
                          : "tabular font-semibold text-[var(--ok)]"
                      }
                      title={
                        metrics.clientTotal > 0
                          ? `${((metrics.grossProfit / metrics.clientTotal) * 100).toFixed(0)}% de lo facturado`
                          : undefined
                      }
                    >
                      {formatMoney(metrics.grossProfit, campaign.currency)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-[var(--text-muted)]">
                      {formatDate(campaign.startDate)}
                      <br />
                      {campaign.endDate ? formatDate(campaign.endDate) : "Abierta"}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--surface-2)] font-semibold">
                <td className="h-12 pl-4" />
                <td className="h-12 px-4">
                  Totales
                  <span className="ml-2 font-normal text-[var(--text-subtle)]">
                    {filtered.length} campañas
                  </span>
                </td>
                <td colSpan={3} />
                <td className="tabular px-4 text-right">{formatCompact(totals.views)}</td>
                <td />
                <td className="tabular px-4 text-right">{formatMoney(totals.budget)}</td>
                <td className="tabular px-4 text-right text-[var(--ok)]">{formatMoney(totals.profit)}</td>
                <td />
              </tr>
            </tfoot>
            </Table>
          </TableWrap>
          <Paginador {...pagina} />
        </>
      )}
    </div>
  );
}
