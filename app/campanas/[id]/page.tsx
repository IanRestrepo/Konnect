import { campaignTotals } from "@/lib/pricing";
import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DefList, DefRow } from "@/components/ui/def-list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ViewsChart, type ChartPoint } from "@/components/campaigns/views-chart";
import { DeliverablesSection } from "@/components/campaigns/deliverables-section";
import { CampaignSwitch } from "@/components/campaigns/campaign-switch";
import { EditCampaignButton } from "@/components/campaigns/edit-campaign-dialog";
import {
  campaignMetrics,
  creatorHasYoutubeAnalytics,
  getCampaign,
  getCompany,
  getCreators,
} from "@/lib/data";
import { listSessions } from "@/lib/store";
import { LinkedNotes } from "@/components/notes/linked-notes";
import { DuplicateCampaignButton } from "@/components/campaigns/duplicate-campaign";
import { CampaignMetrics, type MetricRow } from "@/components/campaigns/campaign-metrics";
import { CAMPAIGN_OBJECTIVE, CAMPAIGN_STATUS } from "@/lib/labels";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

export default async function CampanaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_campanas");
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [company, creators, todasSesiones] = await Promise.all([
    getCompany(campaign.companyId),
    getCreators(),
    listSessions(),
  ]);
  const sessions = todasSesiones.filter((s) => s.campaignId === campaign.id);
  const metrics = campaignMetrics(campaign);
  const status = CAMPAIGN_STATUS[campaign.status];
  const pace = campaignTotals(campaign).budgetUsedPct ?? 0;

  const chart: ChartPoint[] = campaign.deliverables
    .filter((d) => d.status === "publicado" && d.views)
    .map((d) => ({
      label: creators.find((c) => c.id === d.creatorId)?.name.split(" ")[0] ?? "—",
      vistas: d.views ?? 0,
      tipo: d.type,
    }));

  // El módulo de métricas solo aparece si algún creador de la campaña tiene su
  // cuenta de YouTube conectada. El resto de campañas se quedan como estaban.
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const connectedIds = new Set(
    creators.filter(creatorHasYoutubeAnalytics).map((c) => c.id),
  );
  const connectedInCampaign = [
    ...new Set(
      campaign.deliverables
        .filter((d) => connectedIds.has(d.creatorId))
        .map((d) => creatorById.get(d.creatorId)?.name ?? "—"),
    ),
  ];
  // Escotilla para previsualizar el módulo sin conectar ninguna cuenta:
  // METRICS_PREVIEW=1 en el entorno. Quitar cuando el sync esté en marcha.
  const previewMetrics = process.env.METRICS_PREVIEW === "1";
  const metricRows: MetricRow[] = campaign.deliverables.map((d) => ({
    id: d.id,
    title: d.title ?? "",
    creator: creatorById.get(d.creatorId)?.name ?? "—",
    platform: d.platform,
    type: d.type,
    status: d.status,
    publishedAt: d.publishedAt,
    views: d.views,
    likes: d.likes,
    comments: d.comments,
    hasAnalytics: connectedIds.has(d.creatorId),
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
            <span className="flex gap-2">
              <DuplicateCampaignButton campaignId={campaign.id} nombre={campaign.name} />
              <EditCampaignButton campaign={campaign} />
            </span>
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

      {(previewMetrics || connectedInCampaign.length > 0) && (
        <CampaignMetrics rows={metricRows} connectedCreators={connectedInCampaign} />
      )}

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

          {/* Cada creador tiene su propia sesión de entregas: desde aquí se
              llega a su checklist y a su código, sin pasar por Sesiones. */}
          <Card>
            <CardHeader>
              <CardTitle>Sesiones de entrega</CardTitle>
            </CardHeader>
            {sessions.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                Esta campaña no tiene sesiones. Las campañas creadas antes de esta versión no las
                generaron automáticamente.
              </p>
            ) : (
              <ul className="px-2 pb-2">
                {sessions.map((s) => {
                  const suyo = creators.find((c) => c.id === s.creatorId);
                  const pendientes = s.requirements.filter((r) => r.status !== "aprobado").length;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/sesiones/${s.id}`}
                        className="flex items-center gap-3 rounded-[var(--r-control)] px-3 py-2.5 transition hover:bg-[var(--surface-2)]"
                      >
                        <Avatar src={suyo?.avatarUrl ?? null} name={suyo?.name ?? s.name} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">
                            {suyo?.name ?? s.name}
                          </span>
                          <span className="block text-[12px] text-[var(--text-subtle)]">
                            {s.requirements.length === 0
                              ? "Sin peticiones"
                              : pendientes === 0
                                ? "Todo aprobado"
                                : `${pendientes} por resolver`}
                          </span>
                        </span>
                        <Badge tone={s.status === "abierta" ? "ok" : "neutral"}>
                          {s.status === "abierta" ? "Abierta" : "Cerrada"}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Apuntes de la campaña</CardTitle>
            </CardHeader>
            <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              {campaign.notes || "Sin apuntes."}
            </p>
          </Card>

          <LinkedNotes campaignId={campaign.id} />
        </div>
      </div>
    </div>
  );
}
