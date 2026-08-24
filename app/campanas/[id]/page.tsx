import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DefList, DefRow } from "@/components/ui/def-list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ViewsChart, type ChartPoint } from "@/components/campaigns/views-chart";
import { DeliverablesSection } from "@/components/campaigns/deliverables-section";
import { CampaignSwitch } from "@/components/campaigns/campaign-switch";
import { campaignMetrics, getCampaign, getCompany, getCreators } from "@/lib/data";
import { CAMPAIGN_OBJECTIVE, CAMPAIGN_STATUS } from "@/lib/labels";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

export default async function CampanaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_campanas");
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [company, creators] = await Promise.all([getCompany(campaign.companyId), getCreators()]);
  const metrics = campaignMetrics(campaign);
  const status = CAMPAIGN_STATUS[campaign.status];
  const pace = campaign.budget > 0 ? (metrics.spent / campaign.budget) * 100 : 0;

  const chart: ChartPoint[] = campaign.deliverables
    .filter((d) => d.status === "publicado" && d.views)
    .map((d) => ({
      label: creators.find((c) => c.id === d.creatorId)?.name.split(" ")[0] ?? "—",
      vistas: d.views ?? 0,
      tipo: d.type,
    }));

  return (
    <div className="space-y-7">
      <Link
        href="/campanas"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} />
        Campañas
      </Link>

      <div>
        <PageTitle
          eyebrow={company?.name ?? "Sin cliente"}
          title={campaign.name}
          description={CAMPAIGN_OBJECTIVE[campaign.objective]}
          actions={
            <Button variant="primary" size="lg">
              Editar campaña
              <Pencil size={15} />
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CampaignSwitch campaignId={campaign.id} status={campaign.status} />
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge plain>
            {formatDate(campaign.startDate)} — {campaign.endDate ? formatDate(campaign.endDate) : "abierta"}
          </Badge>
        </div>
      </div>

      <StatBand>
        <Stat
          label="Vistas totales"
          value={formatCompact(metrics.views)}
          hint={`${metrics.published}/${metrics.total} publicados`}
        />
        <Stat
          label="Interacciones"
          value={formatCompact(metrics.likes + metrics.comments)}
          hint={metrics.engagementRate ? `${metrics.engagementRate.toFixed(2)}% del alcance` : "—"}
        />
        <Stat
          label="CPM efectivo"
          value={metrics.cpm ? `$${metrics.cpm.toFixed(2)}` : "—"}
          hint="costo por mil vistas"
        />
        <Stat
          label="Comprometido"
          value={formatMoney(metrics.spent, campaign.currency)}
          hint={`de ${formatMoney(campaign.budget, campaign.currency)}`}
        />
      </StatBand>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vistas por entregable</CardTitle>
              <span className="eyebrow">Barras claras = shorts</span>
            </CardHeader>
            <ViewsChart data={chart} />
          </Card>

          <DeliverablesSection
            campaignId={campaign.id}
            deliverables={campaign.deliverables}
            creators={creators}
            currency={campaign.currency}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto</CardTitle>
              <span className="tabular text-[13px] font-medium">{pace.toFixed(0)}%</span>
            </CardHeader>
            <div className="px-5 pb-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.min(100, pace)}%` }}
                />
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">
                {formatMoney(metrics.spent, campaign.currency)} comprometido de{" "}
                {formatMoney(campaign.budget, campaign.currency)}
              </p>
            </div>
            <DefList className="border-t border-[var(--line)]">
              <DefRow label="Cliente">
                {company ? (
                  <Link href={`/empresas/${company.id}`} className="hover:text-[var(--accent)]">
                    {company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DefRow>
              <DefRow label="Objetivo">{CAMPAIGN_OBJECTIVE[campaign.objective]}</DefRow>
              <DefRow label="Inicio">{formatDate(campaign.startDate)}</DefRow>
              <DefRow label="Fin">
                {campaign.endDate ? formatDate(campaign.endDate) : "Abierta"}
              </DefRow>
            </DefList>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              {campaign.notes || "Sin notas."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
