import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageTitle, SectionHead } from "@/components/ui/section";
import { Stat, StatBand } from "@/components/ui/stat";
import { ListBox, ListRow } from "@/components/ui/list";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { campaignMetrics, getCampaigns, getCompanies, getCreators } from "@/lib/data";
import { CAMPAIGN_STATUS, DELIVERABLE_STATUS, DELIVERABLE_TYPE } from "@/lib/labels";
import {
  activeCampaignsSeries,
  budgetSeries,
  engagementSeries,
  trend,
  viewsSeries,
} from "@/lib/series";
import { formatCompact, formatMoney } from "@/lib/utils";

export default async function DashboardPage() {
  await requirePermission("ver_panel");
  const [creators, companies, campaigns] = await Promise.all([
    getCreators(),
    getCompanies(),
    getCampaigns(),
  ]);

  const active = campaigns.filter((c) => c.status === "activa");
  const rows = campaigns
    .filter((c) => c.status !== "borrador")
    .map((campaign) => ({ campaign, metrics: campaignMetrics(campaign) }))
    .sort((a, b) => b.metrics.views - a.metrics.views);

  const totalViews = rows.reduce((s, r) => s + r.metrics.views, 0);
  const totalSpent = rows.reduce((s, r) => s + r.metrics.spent, 0);
  const committed = active.reduce((s, c) => s + c.budget, 0);
  const blendedCpm = totalViews > 0 ? (totalSpent / totalViews) * 1000 : null;

  // Series calculadas de las fechas reales de publicación y de campaña.
  const vistas = viewsSeries(campaigns);
  const interacciones = engagementSeries(campaigns);
  const activas = activeCampaignsSeries(campaigns);
  const presupuesto = budgetSeries(campaigns);
  const totalEngagement = rows.reduce((s, r) => s + r.metrics.likes + r.metrics.comments, 0);

  const pending = campaigns
    .flatMap((campaign) =>
      campaign.deliverables
        .filter((d) => d.status !== "publicado" && d.status !== "cancelado")
        .map((d) => ({ deliverable: d, campaign })),
    )
    .slice(0, 5);

  const topCreators = [...creators]
    .filter((c) => c.status === "activo")
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <PageTitle
        title="Panel"
        description="Rendimiento de las campañas y estado de los entregables."
        actions={
          <>
            <Button variant="secondary">Últimos 30 días</Button>
            <Link href="/campanas/nueva">
              <Button variant="primary">
                <Plus size={15} strokeWidth={2} />
                Nueva campaña
              </Button>
            </Link>
          </>
        }
      />

      <StatBand>
        <Stat
          label="Campañas activas"
          value={String(active.length)}
          hint={`${campaigns.length} en total`}
          series={activas}
        />
        <Stat
          label="Vistas acumuladas"
          value={formatCompact(totalViews)}
          hint="últimos 6 meses"
          delta={trend(vistas) ?? undefined}
          series={vistas}
        />
        <Stat
          label="Interacciones"
          value={formatCompact(totalEngagement)}
          hint={blendedCpm ? `CPM combinado $${blendedCpm.toFixed(2)}` : "sin vistas aún"}
          delta={trend(interacciones) ?? undefined}
          series={interacciones}
        />
        <Stat
          label="Presupuesto comprometido"
          value={formatMoney(committed)}
          hint={`${creators.filter((c) => c.status === "activo").length} creadores activos`}
          series={presupuesto}
        />
      </StatBand>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section>
          <SectionHead
            title="Rendimiento por campaña"
            hint="Ordenado por vistas"
            action={
              <Link
                href="/campanas"
                className="text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                Ver todas
              </Link>
            }
          />
          {/* Teléfono: la tabla de 5 columnas no cabe, va como lista. */}
          <ListBox className="sm:hidden">
            {rows.map(({ campaign, metrics }) => {
              const company = companies.find((c) => c.id === campaign.companyId);
              const status = CAMPAIGN_STATUS[campaign.status];
              return (
                <ListRow
                  key={campaign.id}
                  href={`/campanas/${campaign.id}`}
                  title={campaign.name}
                  subtitle={`${company?.name ?? "Sin cliente"} · ${metrics.published}/${metrics.total} entregables`}
                  trailing={
                    <span className="flex flex-col items-end gap-1">
                      <span className="tabular text-[13px] font-semibold">
                        {formatCompact(metrics.views)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                  }
                />
              );
            })}
          </ListBox>

          <TableWrap className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>Campaña</Th>
                  <Th>Estado</Th>
                  <Th align="right">Vistas</Th>
                  <Th align="right">CPM</Th>
                  <Th align="right">Presupuesto</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ campaign, metrics }) => {
                  const company = companies.find((c) => c.id === campaign.companyId);
                  const status = CAMPAIGN_STATUS[campaign.status];
                  return (
                    <Tr key={campaign.id}>
                      <Td>
                        <Link href={`/campanas/${campaign.id}`} className="block max-w-64">
                          <span className="block truncate font-medium">{campaign.name}</span>
                          <span className="block truncate text-[12px] text-[var(--text-muted)]">
                            {company?.name ?? "Sin cliente"} · {metrics.published}/{metrics.total}{" "}
                            entregables
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </Td>
                      <Td align="right" className="tabular font-medium">
                        {formatCompact(metrics.views)}
                      </Td>
                      <Td align="right" className="tabular text-[var(--text-muted)]">
                        {metrics.cpm ? `$${metrics.cpm.toFixed(2)}` : "—"}
                      </Td>
                      <Td align="right" className="tabular">
                        {formatMoney(campaign.budget, campaign.currency)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </section>

        <div className="space-y-6">
          <section>
            <SectionHead title="Entregables abiertos" hint={`${pending.length} sin publicar`} />
            <ListBox>
              {pending.map(({ deliverable, campaign }) => {
                const creator = creators.find((c) => c.id === deliverable.creatorId);
                const status = DELIVERABLE_STATUS[deliverable.status];
                return (
                  <ListRow
                    key={deliverable.id}
                    href={`/campanas/${campaign.id}`}
                    leading={<Avatar src={creator?.avatarUrl} name={creator?.name ?? "?"} size={32} />}
                    title={creator?.name ?? "Sin creador"}
                    subtitle={`${DELIVERABLE_TYPE[deliverable.type]} · ${campaign.name}`}
                    trailing={<Badge tone={status.tone}>{status.label}</Badge>}
                  />
                );
              })}
            </ListBox>
          </section>

          <section>
            <SectionHead title="Creadores por alcance" hint="Solo activos" />
            <ListBox>
              {topCreators.map((creator) => (
                <ListRow
                  key={creator.id}
                  href={`/creadores/${creator.id}`}
                  leading={<Avatar src={creator.avatarUrl} name={creator.name} size={32} />}
                  title={creator.name}
                  subtitle={`${creator.category} · ${formatCompact(creator.subscribers)} suscriptores`}
                  trailing={
                    <span className="tabular text-[13px] font-medium">
                      {formatCompact(creator.totalViews)}
                    </span>
                  }
                />
              ))}
            </ListBox>
          </section>
        </div>
      </div>
    </div>
  );
}
