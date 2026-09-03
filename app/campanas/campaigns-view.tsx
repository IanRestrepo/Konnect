"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Megaphone, Plus, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Segmented, SearchInput, Toolbar } from "@/components/shell/toolbar";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { ListBox, ListRow } from "@/components/ui/list";
import { CampaignStatusControl } from "@/components/campaigns/campaign-status-control";
import { CAMPAIGN_OBJECTIVE, CAMPAIGN_STATUS } from "@/lib/labels";
import type { Campaign, CampaignMetrics, CampaignStatus, Company, Creator } from "@/lib/types";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";

export type CampaignRow = {
  campaign: Campaign;
  metrics: CampaignMetrics;
  company: Company | null;
  creators: Creator[];
};

type Filter = CampaignStatus | "todas";

export function CampaignsView({ rows }: { rows: CampaignRow[] }) {
  const [tab, setTab] = useState<Filter>("todas");
  const [query, setQuery] = useState("");

  const tabs = useMemo<{ id: Filter; label: string; count: number }[]>(() => {
    const count = (status: CampaignStatus) =>
      rows.filter((r) => r.campaign.status === status).length;
    return [
      { id: "todas", label: "Todas", count: rows.length },
      { id: "activa", label: "Activas", count: count("activa") },
      { id: "pausada", label: "Pausadas", count: count("pausada") },
      { id: "borrador", label: "Borradores", count: count("borrador") },
      { id: "finalizada", label: "Finalizadas", count: count("finalizada") },
      { id: "cancelada", label: "Canceladas", count: count("cancelada") },
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ campaign, company }) => {
      if (tab !== "todas" && campaign.status !== tab) return false;
      if (!q) return true;
      return `${campaign.name} ${company?.name ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, { campaign, metrics }) => ({
          budget: acc.budget + metrics.clientTotal,
          spent: acc.spent + metrics.spent,
          views: acc.views + metrics.views,
        }),
        { budget: 0, spent: 0, views: 0 },
      ),
    [filtered],
  );

  function exportCsv() {
    downloadCsv(`konnect-campanas-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Campaña",
        "Cliente",
        "Estado",
        "Objetivo",
        "Creadores",
        "Vistas",
        "Interacciones",
        "CPM",
        "Comprometido",
        "Facturado",
        "Moneda",
        "Inicio",
        "Fin",
      ],
      ...filtered.map(({ campaign, metrics, company, creators }) => [
        campaign.name,
        company?.name ?? "",
        CAMPAIGN_STATUS[campaign.status].label,
        CAMPAIGN_OBJECTIVE[campaign.objective],
        creators.map((c) => c.name).join(", "),
        metrics.views,
        metrics.likes + metrics.comments,
        metrics.cpm ? metrics.cpm.toFixed(2) : "",
        metrics.spent,
        metrics.clientTotal,
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
            {filtered.map(({ campaign, metrics, company, creators }) => {
              return (
                <ListRow
                  key={campaign.id}
                  href={`/campanas/${campaign.id}`}
                  title={campaign.name}
                  subtitle={`${company?.name ?? "Sin cliente"} · ${creators.length} creadores`}
                  trailing={
                    <span className="flex items-center gap-3">
                      <span className="flex flex-col items-end gap-1">
                        <span className="tabular text-[13px] font-semibold">
                          {formatCompact(metrics.views)}
                        </span>
                      </span>
                      <CampaignStatusControl campaignId={campaign.id} status={campaign.status} />
                    </span>
                  }
                />
              );
            })}
          </ListBox>

          <TableWrap className="hidden lg:block">
            <Table className="min-w-[880px]">
            <thead>
              <tr>
                <Th className="pl-4">Campaña</Th>
                <Th>Creadores</Th>
                <Th>Estado</Th>
                <Th align="right">Vistas</Th>
                <Th align="right">CPM</Th>
                <Th align="right">Facturado</Th>
                <Th>Periodo</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ campaign, metrics, company, creators }) => {
                return (
                  <Tr key={campaign.id}>
                    <Td className="pl-4">
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
                      <CampaignStatusControl campaignId={campaign.id} status={campaign.status} />
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
                <td colSpan={2} />
                <td className="tabular px-4 text-right">{formatCompact(totals.views)}</td>
                <td />
                <td className="tabular px-4 text-right">{formatMoney(totals.budget)}</td>
                <td />
              </tr>
            </tfoot>
            </Table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
