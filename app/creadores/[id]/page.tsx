import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Film, RefreshCw } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DefList, DefRow } from "@/components/ui/def-list";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BankingPanel } from "@/components/creators/banking-panel";
import { ChannelsPanel } from "@/components/creators/channels-panel";
import { SocialsPanel } from "@/components/creators/socials-panel";
import { ApiConnectionsPanel } from "@/components/creators/api-connections-panel";
import { ContactsPanel } from "@/components/companies/contacts-panel";
import { LinkedNotes } from "@/components/notes/linked-notes";
import { EditCreatorButton } from "@/components/creators/edit-creator-dialog";
import { creatorCampaigns, getCampaigns, getCreator } from "@/lib/data";
import {
  CREATOR_STATUS,
  DELIVERABLE_STATUS,
  DELIVERABLE_TYPE,
  PAYMENT_METHOD,
} from "@/lib/labels";
import { PLATFORM_METRICS } from "@/lib/socials";
import { creatorViewsSeries, trend } from "@/lib/series";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

export default async function CreadorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_creadores");
  const { id } = await params;
  const [creator, campaigns] = await Promise.all([getCreator(id), getCampaigns()]);
  if (!creator) notFound();

  // Las métricas se nombran según dónde publica: un TikToker no tiene suscriptores.
  const metricas = PLATFORM_METRICS[creator.mainPlatform];

  const related = creatorCampaigns(campaigns, creator.id);
  const status = CREATOR_STATUS[creator.status];

  const deliverables = related.flatMap((campaign) =>
    campaign.deliverables
      .filter((d) => d.creatorId === creator.id)
      .map((d) => ({ deliverable: d, campaign })),
  );

  const serieVistas = creatorViewsSeries(campaigns, creator.id);
  const generatedViews = deliverables.reduce((s, d) => s + (d.deliverable.views ?? 0), 0);
  const billed = deliverables
    .filter((d) => d.deliverable.status !== "cancelado")
    .reduce((s, d) => s + d.deliverable.agreedFee, 0);

  return (
    <div className="space-y-7">
      <Link
        href="/creadores"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} />
        Creadores
      </Link>

      <div className="flex items-start gap-4">
        <Avatar src={creator.avatarUrl} name={creator.name} size={64} />
        <div className="min-w-0 flex-1">
          <PageTitle
            title={creator.name}
            description={[creator.handle, creator.country].filter(Boolean).join(" · ")}
            actions={
              <>
                {/* Un creador de TikTok o Instagram no tiene canal que abrir. */}
                {creator.channelUrl && (
                  <Link href={creator.channelUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="icon-lg" aria-label="Abrir canal">
                      <ExternalLink size={17} strokeWidth={1.75} />
                    </Button>
                  </Link>
                )}
                <Button variant="secondary" size="icon-lg" aria-label="Actualizar métricas">
                  <RefreshCw size={17} strokeWidth={1.75} />
                </Button>
                <EditCreatorButton creator={creator} />
              </>
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone="accent" plain>
              {creator.category}
            </Badge>
            {creator.paymentMethods.map((m) => (
              <Badge key={m} plain>
                {PAYMENT_METHOD[m]}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <StatBand>
        <Stat label={metricas.audience} value={formatCompact(creator.subscribers)} />
        <Stat label={metricas.views} value={formatCompact(creator.totalViews)} />
        <Stat label={metricas.content} value={formatCompact(creator.videoCount)} />
        <Stat
          label="Vistas para clientes"
          value={formatCompact(generatedViews)}
          hint={`${deliverables.length} entregables`}
          delta={trend(serieVistas) ?? undefined}
          series={serieVistas}
        />
      </StatBand>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tarifas mínimas acordadas</CardTitle>
              <span className="eyebrow">{creator.currency}</span>
            </CardHeader>
            <DefList className="border-t border-[var(--line)]">
              <DefRow label="Video dedicado">
                <span className="tabular">{formatMoney(creator.rateVideo, creator.currency)}</span>
              </DefRow>
              <DefRow label="Reel / Short">
                <span className="tabular">{formatMoney(creator.rateShort, creator.currency)}</span>
              </DefRow>
              <DefRow label="Fracción publicitaria en video">
                <span className="tabular">
                  {formatMoney(creator.rateIntegration, creator.currency)}
                </span>
              </DefRow>
              <DefRow label="Facturado a la fecha">
                <span className="tabular">{formatMoney(billed, creator.currency)}</span>
              </DefRow>
            </DefList>
          </Card>

          <section>
            <SectionLabel>Entregables</SectionLabel>
            {deliverables.length === 0 ? (
              <Card className="px-5 py-6 text-[13px] text-[var(--text-muted)]">
                Todavía no participa en ninguna campaña.
              </Card>
            ) : (
              <ListBox>
                {deliverables.map(({ deliverable, campaign }) => {
                  const st = DELIVERABLE_STATUS[deliverable.status];
                  return (
                    <ListRow
                      key={deliverable.id}
                      href={`/campanas/${campaign.id}`}
                      leading={
                        <RowIcon>
                          <Film size={17} strokeWidth={1.75} />
                        </RowIcon>
                      }
                      title={deliverable.title ?? "Sin publicar"}
                      subtitle={`${campaign.name} · ${DELIVERABLE_TYPE[deliverable.type]}`}
                      trailing={
                        <span className="flex items-center gap-4">
                          <span className="hidden text-right sm:block">
                            <span className="tabular block text-[14px] font-semibold">
                              {deliverable.views ? formatCompact(deliverable.views) : "—"}
                            </span>
                            <span className="block text-[11.5px] text-[var(--text-subtle)]">
                              vistas
                            </span>
                          </span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </span>
                      }
                    />
                  );
                })}
              </ListBox>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
            </CardHeader>
            <DefList className="border-t border-[var(--line)]">
              <DefRow label="Correo">
                <a href={`mailto:${creator.email}`} className="hover:text-[var(--accent)]">
                  {creator.email}
                </a>
              </DefRow>
              <DefRow label="Teléfono">
                <a
                  href={`tel:${creator.phone.replace(/\s/g, "")}`}
                  className="tabular hover:text-[var(--accent)]"
                >
                  {creator.phone}
                </a>
              </DefRow>
              <DefRow label="En cartera desde">{formatDate(creator.createdAt)}</DefRow>
            </DefList>
          </Card>

          <ChannelsPanel
            creatorId={creator.id}
            principal={{
              name: creator.name,
              handle: creator.handle,
              avatarUrl: creator.avatarUrl,
              subscribers: creator.subscribers,
              channelUrl: creator.channelUrl,
            }}
            channels={creator.channels}
          />

          <SocialsPanel creatorId={creator.id} socials={creator.socials} />

          <ApiConnectionsPanel
            creatorId={creator.id}
            connections={creator.apiConnections}
          />

          <LinkedNotes creatorId={creator.id} />

          {/* Con quién se habla: el creador, su mánager o su agencia. */}
          <ContactsPanel
            endpoint={`/api/creadores/${creator.id}/contactos`}
            permiso="editar_creadores"
            contacts={creator.contacts}
            titulo="Personas de contacto"
            vacio="Solo el contacto de la ficha. Añade mánager o representante si los hay."
            exigeUno={false}
          />

          <BankingPanel
            creatorId={creator.id}
            hints={{
              accountNumber: creator.banking.accountNumber,
              routing: creator.banking.routing,
              taxId: creator.banking.taxId,
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Notas internas</CardTitle>
            </CardHeader>
            <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              {creator.notes || "Sin notas."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
