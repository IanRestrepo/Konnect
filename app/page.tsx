import { requirePermission } from "@/lib/session";
import Link from "next/link";
import {
  Building2,
  FileText,
  FolderOpen,
  Megaphone,
  Plus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { PageTitle, SectionHead } from "@/components/ui/section";
import { Stat, StatBand } from "@/components/ui/stat";
import { ListBox, ListRow } from "@/components/ui/list";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { campaignMetrics, getCampaigns, getCompanies, getCreators } from "@/lib/data";
import { listOpenTasks, listSessions } from "@/lib/store";
import { campanasVisibles, sesionesVisibles } from "@/lib/campaign-access";
import { hasPermission, type PermissionId } from "@/lib/permissions";
import { creatorPayout } from "@/lib/pricing";
import { CAMPAIGN_STATUS, DELIVERABLE_STATUS } from "@/lib/labels";
import { piezaLabel } from "@/lib/socials";
import {
  activeCampaignsSeries,
  budgetSeries,
  engagementSeries,
  trend,
  viewsSeries,
} from "@/lib/series";
import { formatCompact, formatMoney } from "@/lib/utils";

/** «hace 3 h», para saber cuánto lleva esperando algo. */
function hace(fecha: string | null): string {
  if (!fecha) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Sin nada que mostrar, una línea y no una lista vacía. */
function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--r-card)] border border-dashed border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function VerTodo({ href, children = "Ver todo" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
    >
      {children}
    </Link>
  );
}

/**
 * El inicio.
 *
 * Antes solo informaba: cifras, una tabla y una lista de creadores por
 * alcance que nadie usaba para decidir nada. Ahora arranca con lo que hay que
 * hacer —lo que entregaron los creadores y espera revisión, las piezas sin
 * publicar, los pagos por hacer y las tareas de las notas— y con accesos
 * directos para crear lo que más se crea.
 */
export default async function DashboardPage() {
  const session = await requirePermission("ver_panel");
  const puede = (p: PermissionId) => hasPermission(session.permissions, p);

  const [creators, companies, todas, todasSesiones, tareas] = await Promise.all([
    getCreators(),
    getCompanies(),
    getCampaigns(),
    puede("ver_sesiones") ? listSessions() : Promise.resolve([]),
    puede("ver_notas") ? listOpenTasks(6) : Promise.resolve(null),
  ]);

  // Quien solo ve sus campañas, ve aquí solo lo suyo.
  const campaigns = campanasVisibles(session, todas);
  const sesiones = sesionesVisibles(session, todasSesiones, todas);
  const creador = (id: string | null) => creators.find((c) => c.id === id);
  const sesionDe = (campaignId: string, creatorId: string) =>
    sesiones.find((s) => s.campaignId === campaignId && s.creatorId === creatorId);

  const active = campaigns.filter((c) => c.status === "activa");
  const rows = campaigns
    .filter((c) => c.status !== "borrador")
    .map((campaign) => ({ campaign, metrics: campaignMetrics(campaign) }))
    .sort((a, b) => b.metrics.views - a.metrics.views);

  const totalViews = rows.reduce((s, r) => s + r.metrics.views, 0);
  const totalSpent = rows.reduce((s, r) => s + r.metrics.spent, 0);
  const committed = active.reduce((s, c) => s + campaignMetrics(c).spent, 0);
  const blendedCpm = totalViews > 0 ? (totalSpent / totalViews) * 1000 : null;

  // Series calculadas de las fechas reales de publicación y de campaña.
  const vistas = viewsSeries(campaigns);
  const interacciones = engagementSeries(campaigns);
  const activas = activeCampaignsSeries(campaigns);
  const presupuesto = budgetSeries(campaigns);
  const totalEngagement = rows.reduce((s, r) => s + r.metrics.likes + r.metrics.comments, 0);

  /* ---- Lo que hay que hacer ---- */

  // Lo que el creador mandó y nadie ha revisado: lo más urgente, porque él
  // está esperando respuesta.
  const porRevisar = sesiones
    .flatMap((s) =>
      s.requirements.filter((r) => r.status === "enviado").map((r) => ({ sesion: s, req: r })),
    )
    .sort((a, b) => (a.req.submittedAt ?? "").localeCompare(b.req.submittedAt ?? ""));

  const enMarcha = campaigns.filter((c) => c.status === "activa" || c.status === "pausada");

  const pendientes = enMarcha
    .flatMap((campaign) =>
      campaign.deliverables
        .filter((d) => d.status === "pendiente" || d.status === "en_revision")
        .map((d) => ({ deliverable: d, campaign })),
    )
    // Primero lo que está en revisión: ya hay algo que mirar.
    .sort((a, b) =>
      a.deliverable.status === b.deliverable.status
        ? 0
        : a.deliverable.status === "en_revision"
          ? -1
          : 1,
    );

  const porPagar = campaigns.flatMap((campaign) =>
    campaign.deliverables
      .filter((d) => d.status === "publicado" && d.paymentStatus !== "pagado")
      .map((d) => ({ deliverable: d, campaign, monto: creatorPayout(d, campaign) })),
  );
  const totalPorPagar = porPagar.reduce((s, p) => s + p.monto, 0);

  const acciones: { href: string; label: string; hint: string; icon: LucideIcon; permiso: PermissionId }[] = [
    {
      href: "/campanas/nueva",
      label: "Nueva campaña",
      hint: "Cliente, creadores y precios",
      icon: Megaphone,
      permiso: "editar_campanas",
    },
    {
      href: "/creadores?nuevo=1",
      label: "Nuevo influencer",
      hint: "Su ficha, redes y tarifas",
      icon: UserPlus,
      permiso: "editar_creadores",
    },
    {
      href: "/empresas?nueva=1",
      label: "Nueva empresa",
      hint: "Un cliente con sus contactos",
      icon: Building2,
      permiso: "editar_empresas",
    },
    {
      href: "/notas",
      label: "Notas",
      hint: tareas ? `${tareas.total} tareas abiertas` : "El bloc del equipo",
      icon: FileText,
      permiso: "ver_notas",
    },
  ];
  const misAcciones = acciones.filter((a) => puede(a.permiso));

  return (
    <div className="space-y-8">
      <PageTitle title="Inicio" description="Lo que hay que hacer hoy y cómo van las campañas." />

      {misAcciones.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {misAcciones.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-3 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 transition hover:border-[var(--line-strong)]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-control)] bg-[var(--surface-3)] text-[var(--text-muted)] transition group-hover:text-[var(--accent)]">
                <a.icon size={17} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{a.label}</span>
                <span className="block truncate text-[12px] text-[var(--text-muted)]">{a.hint}</span>
              </span>
              {a.permiso.startsWith("editar") && (
                <Plus size={15} className="shrink-0 text-[var(--text-subtle)]" />
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {puede("ver_sesiones") && (
            <section>
              <SectionHead
                title="Por revisar"
                hint={
                  porRevisar.length
                    ? `${porRevisar.length} entrega${porRevisar.length === 1 ? "" : "s"} esperando respuesta`
                    : undefined
                }
                action={<VerTodo href="/sesiones">Sesiones</VerTodo>}
              />
              {porRevisar.length === 0 ? (
                <Vacio>Nada esperando revisión. Lo que entreguen los creadores aparece aquí.</Vacio>
              ) : (
                <ListBox>
                  {porRevisar.slice(0, 6).map(({ sesion, req }) => {
                    const quien = creador(sesion.creatorId);
                    return (
                      <ListRow
                        key={req.id}
                        href={`/sesiones/${sesion.id}`}
                        leading={<Avatar src={quien?.avatarUrl} name={quien?.name ?? sesion.name} size={32} />}
                        title={`${quien?.name ?? sesion.name} entregó «${req.title}»`}
                        subtitle={[
                          campaigns.find((c) => c.id === sesion.campaignId)?.name,
                          req.notes ? `«${req.notes}»` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        trailing={
                          <span className="whitespace-nowrap text-[12px] text-[var(--warn)]">
                            {hace(req.submittedAt)}
                          </span>
                        }
                      />
                    );
                  })}
                </ListBox>
              )}
            </section>
          )}

          <section>
            <SectionHead
              title="Entregables pendientes"
              hint={pendientes.length ? `${pendientes.length} sin publicar` : undefined}
              action={<VerTodo href="/campanas">Campañas</VerTodo>}
            />
            {pendientes.length === 0 ? (
              <Vacio>Todas las piezas de las campañas en marcha están publicadas.</Vacio>
            ) : (
              <ListBox>
                {pendientes.slice(0, 6).map(({ deliverable, campaign }) => {
                  const quien = creador(deliverable.creatorId);
                  const status = DELIVERABLE_STATUS[deliverable.status];
                  const sesion = sesionDe(campaign.id, deliverable.creatorId);
                  return (
                    <ListRow
                      key={deliverable.id}
                      href={sesion ? `/sesiones/${sesion.id}` : `/campanas/${campaign.id}`}
                      leading={<Avatar src={quien?.avatarUrl} name={quien?.name ?? "?"} size={32} />}
                      title={quien?.name ?? "Sin creador"}
                      subtitle={`${piezaLabel(
                        deliverable.platform,
                        deliverable.type,
                        deliverable.customType,
                      )} · ${campaign.name}`}
                      trailing={<Badge tone={status.tone}>{status.label}</Badge>}
                    />
                  );
                })}
              </ListBox>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionHead
              title="Pagos por hacer"
              hint={porPagar.length ? `${formatMoney(totalPorPagar)} a creadores` : undefined}
            />
            {porPagar.length === 0 ? (
              <Vacio>Ningún pago pendiente de piezas publicadas.</Vacio>
            ) : (
              <ListBox>
                {porPagar.slice(0, 5).map(({ deliverable, campaign, monto }) => {
                  const quien = creador(deliverable.creatorId);
                  return (
                    <ListRow
                      key={deliverable.id}
                      href={`/campanas/${campaign.id}/creador/${deliverable.creatorId}`}
                      leading={<Avatar src={quien?.avatarUrl} name={quien?.name ?? "?"} size={32} />}
                      title={quien?.name ?? "Sin creador"}
                      subtitle={`${piezaLabel(deliverable.platform, deliverable.type, deliverable.customType)} · ${campaign.name}`}
                      trailing={
                        <span className="flex flex-col items-end gap-1">
                          <span className="tabular text-[13px] font-semibold">
                            {formatMoney(monto, campaign.currency)}
                          </span>
                          <Badge tone={deliverable.paymentStatus === "aprobado" ? "accent" : "warn"}>
                            {deliverable.paymentStatus === "aprobado" ? "Falta comprobante" : "Por aprobar"}
                          </Badge>
                        </span>
                      }
                    />
                  );
                })}
              </ListBox>
            )}
          </section>

          {tareas && (
            <section>
              <SectionHead
                title="Tareas"
                hint={tareas.total ? `${tareas.total} sin marcar en las notas` : undefined}
                action={<VerTodo href="/notas">Notas</VerTodo>}
              />
              {tareas.tareas.length === 0 ? (
                <Vacio>
                  Sin tareas abiertas. Las listas de tareas que escribas en las notas aparecen aquí.
                </Vacio>
              ) : (
                <ListBox>
                  {tareas.tareas.map((t, i) => (
                    <ListRow
                      key={`${t.docId}-${i}`}
                      href={`/notas/${t.docId}`}
                      leading={
                        <span className="grid h-8 w-8 shrink-0 place-items-center">
                          <span className="h-4 w-4 rounded-[5px] border border-[var(--line-strong)]" />
                        </span>
                      }
                      title={t.text}
                      subtitle={
                        <span className="inline-flex items-center gap-1">
                          <FolderOpen size={11} />
                          {t.docTitle}
                        </span>
                      }
                    />
                  ))}
                </ListBox>
              )}
            </section>
          )}
        </div>
      </div>

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

      <section>
        <SectionHead
          title="Rendimiento por campaña"
          hint="Ordenado por vistas"
          action={<VerTodo href="/campanas">Ver todas</VerTodo>}
        />
        {/* Teléfono: la tabla no cabe, va como lista. */}
        <ListBox className="sm:hidden">
          {rows.slice(0, 8).map(({ campaign, metrics }) => {
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
                <Th align="right">Facturado</Th>
                <Th align="right">Ganancia</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map(({ campaign, metrics }) => {
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
                      {formatMoney(metrics.clientTotal, campaign.currency)}
                    </Td>
                    <Td
                      align="right"
                      className={
                        metrics.grossProfit < 0
                          ? "tabular text-[var(--danger)]"
                          : "tabular text-[var(--ok)]"
                      }
                    >
                      {formatMoney(metrics.grossProfit, campaign.currency)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </section>
    </div>
  );
}
