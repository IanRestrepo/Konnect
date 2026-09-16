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
import { CampaignCreators } from "@/components/campaigns/campaign-creators";
import { CampaignSwitch } from "@/components/campaigns/campaign-switch";
import { EditCampaignButton } from "@/components/campaigns/edit-campaign-dialog";
import {
  campaignMetrics,
  creatorHasYoutubeAnalytics,
  getCampaign,
  getCompanies,
  getCompany,
  getCreators,
} from "@/lib/data";
import { listDeliverableKinds, listSessions, listUsers } from "@/lib/store";
import { puedeVerCampana } from "@/lib/campaign-access";
import { CampaignTeam } from "@/components/campaigns/campaign-team";
import { LinkedNotes } from "@/components/notes/linked-notes";
import { DuplicateCampaignButton } from "@/components/campaigns/duplicate-campaign";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign";
import { CampaignMetrics, type MetricRow } from "@/components/campaigns/campaign-metrics";
import { CAMPAIGN_OBJECTIVE, CAMPAIGN_STATUS } from "@/lib/labels";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

export default async function CampanaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("ver_campanas");
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  // Una campaña que no es suya no existe para él: 404 y no 403, que ya
  // confirmaría que la campaña está ahí.
  if (!puedeVerCampana(session, campaign)) notFound();

  const [company, companies, creators, todasSesiones, usuarios, kinds] = await Promise.all([
    getCompany(campaign.companyId),
    getCompanies(),
    getCreators(),
    listSessions(),
    listUsers(),
    listDeliverableKinds(),
  ]);
  // Solo las cuentas activas: asignarle una campaña a alguien que ya no entra
  // deja la ficha diciendo que la lleva quien no la lleva.
  const empleados = usuarios
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }));

  // La cabecera enseña a todos, activos o no: una cuenta desactivada que creó
  // la campaña sigue siendo quien la creó.
  const persona = (id: string | null) => usuarios.find((u) => u.id === id) ?? null;
  const responsable = persona(campaign.managerId);
  const encargados = campaign.memberIds
    .map((id) => persona(id))
    .filter((u): u is NonNullable<typeof u> => u !== null);
  const creadaPor = persona(campaign.createdById);
  const sessions = todasSesiones.filter((s) => s.campaignId === campaign.id);
  const status = CAMPAIGN_STATUS[campaign.status];
  const metrics = campaignMetrics(campaign);
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
    customType: d.customType,
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
              <DeleteCampaignButton
                campaignId={campaign.id}
                nombre={campaign.name}
                sesiones={sessions.length}
              />
              <EditCampaignButton campaign={campaign} companies={companies} />
            </span>
          }
        />
        {/* Quién la lleva, a la vista junto al nombre: es lo primero que se
            pregunta al entrar, y antes había que bajar hasta la tarjeta de
            Equipo para saberlo. */}
        {(responsable || encargados.length > 0 || creadaPor) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-[var(--text-muted)]">
            {(responsable || encargados.length > 0) && (
              <span className="flex items-center gap-2">
                <span className="flex -space-x-2">
                  {[responsable, ...encargados]
                    .filter((u): u is NonNullable<typeof u> => u !== null)
                    .map((u) => (
                      <span
                        key={u.id}
                        title={u.name}
                        className="rounded-full ring-2 ring-[var(--canvas)]"
                      >
                        <Avatar src={u.avatarUrl} name={u.name} size={26} />
                      </span>
                    ))}
                </span>
                <span>
                  {responsable ? (
                    <>
                      Lleva <span className="font-medium text-[var(--text)]">{responsable.name}</span>
                    </>
                  ) : (
                    "Sin responsable"
                  )}
                  {encargados.length > 0 &&
                    ` · con ${encargados.map((u) => u.name.split(" ")[0]).join(", ")}`}
                </span>
              </span>
            )}
            {creadaPor && (
              <span>
                Creada por <span className="text-[var(--text)]">{creadaPor.name}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CampaignSwitch campaignId={campaign.id} status={campaign.status} />
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge plain>
            {formatDate(campaign.startDate)} — {campaign.endDate ? formatDate(campaign.endDate) : "abierta"}
          </Badge>
        </div>
      </div>

      <StatBand className="xl:grid-cols-5">
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
        {/* Lo comprometido solo dice cuánto sale. Lo que se queda la agencia
            es la otra mitad de la cuenta, y la que se quería ver. */}
        <Stat
          label="Ganancia"
          value={formatMoney(metrics.grossProfit, campaign.currency)}
          hint={
            metrics.clientTotal > 0
              ? `${((metrics.grossProfit / metrics.clientTotal) * 100).toFixed(0)}% de ${formatMoney(metrics.clientTotal, campaign.currency)} cobrados`
              : "sin cobros pactados"
          }
          tone={metrics.grossProfit < 0 ? "danger" : "ok"}
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

          {/* Con quién se trabaja y cuánto se le debe. La lista de entregables
              responde qué piezas hay, no eso. */}
          <CampaignCreators
            campaign={campaign}
            creators={creators}
            currency={campaign.currency}
            kinds={kinds}
            empleados={empleados}
          />

          <DeliverablesSection
            campaignId={campaign.id}
            deliverables={campaign.deliverables}
            creators={creators}
            currency={campaign.currency}
            kinds={kinds}
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
                  const abiertas = s.requirements.filter((r) => r.status !== "aprobado");
                  const pendientes = abiertas.length;
                  // La fecha más cercana de lo que sigue abierto: es lo que se
                  // viene encima, y era justo lo que no se veía desde aquí.
                  const proxima = abiertas
                    .map((r) => r.dueDate)
                    .filter((d): d is string => Boolean(d))
                    .sort()[0];
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
                                : `${pendientes} por resolver${
                                    proxima ? ` · próxima el ${formatDate(proxima)}` : ""
                                  }`}
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

          <CampaignTeam
            campaignId={campaign.id}
            managerId={campaign.managerId}
            memberIds={campaign.memberIds}
            empleados={empleados}
          />

          <LinkedNotes campaignId={campaign.id} />
        </div>
      </div>
    </div>
  );
}
