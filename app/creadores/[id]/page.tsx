import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Megaphone, RefreshCw } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DefList, DefRow } from "@/components/ui/def-list";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BankingPanel } from "@/components/creators/banking-panel";
import { ContactCard } from "@/components/creators/contact-card";
import { RatesPanel } from "@/components/creators/rates-panel";
import { ChannelsPanel } from "@/components/creators/channels-panel";
import { SocialsPanel } from "@/components/creators/socials-panel";
import { ApiConnectionsPanel } from "@/components/creators/api-connections-panel";
import { PersonalDataPanel } from "@/components/creators/personal-data-panel";
import { ContactsPanel } from "@/components/companies/contacts-panel";
import { EditCreatorButton } from "@/components/creators/edit-creator-dialog";
import { CreatorTabs } from "@/app/creadores/[id]/creator-tabs";
import { creatorCampaigns, getCampaigns, getCompanies, getCreator } from "@/lib/data";
import { listCreatorCategories } from "@/lib/store";
import { creatorPayout } from "@/lib/pricing";
import { CAMPAIGN_STATUS, CREATOR_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import { PLATFORM_METRICS } from "@/lib/socials";
import { creatorViewsSeries, trend } from "@/lib/series";
import type { Campaign, Company, Creator } from "@/lib/types";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

export default async function CreadorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_creadores");
  const { id } = await params;
  const [creator, campaigns, companies, categories] = await Promise.all([
    getCreator(id),
    getCampaigns(),
    getCompanies(),
    listCreatorCategories(),
  ]);
  if (!creator) notFound();

  // Las métricas se nombran según dónde publica: un TikToker no tiene suscriptores.
  const metricas = PLATFORM_METRICS[creator.mainPlatform];

  const related = creatorCampaigns(campaigns, creator.id);
  const status = CREATOR_STATUS[creator.status];

  const piezas = related.flatMap((campaign) =>
    campaign.deliverables.filter((d) => d.creatorId === creator.id),
  );

  const serieVistas = creatorViewsSeries(campaigns, creator.id);
  const generatedViews = piezas.reduce((s, d) => s + (d.views ?? 0), 0);
  const billed = piezas
    .filter((d) => d.status !== "cancelado")
    .reduce((s, d) => s + d.agreedFee, 0);

  // Las campañas, no las piezas sueltas: la pregunta con la que se abre la
  // ficha es «¿en qué anda ahora?», y una lista de entregables mezclaba lo de
  // este mes con lo de hace un año sin decir de qué campaña era cada cosa.
  const activas = related.filter((c) => c.status === "activa");
  const otras = related.filter((c) => c.status !== "activa");

  const pestanas = [
    {
      id: "campanas",
      label: "Campañas",
      count: activas.length,
      content: (
        <div className="space-y-6">
          <section>
            <SectionLabel>Activas</SectionLabel>
            {activas.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="Sin campañas activas"
                description={
                  otras.length
                    ? "Ahora mismo no está en ninguna campaña en marcha."
                    : "Todavía no participa en ninguna campaña."
                }
              />
            ) : (
              <ListaCampanas
                campanas={activas}
                creator={creator}
                companies={companies}
              />
            )}
          </section>

          {otras.length > 0 && (
            <section>
              <SectionLabel>Anteriores y en pausa</SectionLabel>
              <ListaCampanas campanas={otras} creator={creator} companies={companies} />
            </section>
          )}
        </div>
      ),
    },
    {
      id: "tarifas",
      label: "Tarifas",
      content: (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Lo que de verdad manda al armar una campaña: el precio por red. */}
          <RatesPanel
            creatorId={creator.id}
            rates={creator.rates}
            currency={creator.currency}
            socials={creator.socials.map((s) => s.platform)}
            mainPlatform={creator.mainPlatform}
            channels={creator.channels}
          />
          <Card className="h-fit">
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
        </div>
      ),
    },
    {
      id: "redes",
      label: "Canales y redes",
      count: creator.channels.length + creator.socials.length,
      content: (
        <div className="grid gap-6 xl:grid-cols-2">
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
          <div className="space-y-6">
            <SocialsPanel creatorId={creator.id} socials={creator.socials} />
            <ApiConnectionsPanel creatorId={creator.id} connections={creator.apiConnections} />
          </div>
        </div>
      ),
    },
    {
      id: "contacto",
      label: "Contacto",
      content: (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <ContactCard
              creatorId={creator.id}
              email={creator.email}
              phone={creator.phone}
              createdAt={creator.createdAt}
              fields={creator.contactFields}
            />
            <Card>
              <CardHeader>
                <CardTitle>Notas internas</CardTitle>
              </CardHeader>
              <p className="px-5 pb-5 text-[13px] leading-relaxed whitespace-pre-line text-[var(--text-muted)]">
                {creator.notes || "Sin notas."}
              </p>
            </Card>
          </div>
          {/* Con quién se habla: el creador, su mánager o su agencia. */}
          <ContactsPanel
            endpoint={`/api/creadores/${creator.id}/contactos`}
            permiso="editar_creadores"
            contacts={creator.contacts}
            titulo="Personas de contacto"
            vacio="Solo el contacto de la ficha. Añade mánager o representante si los hay."
            exigeUno={false}
          />
        </div>
      ),
    },
    {
      id: "privado",
      label: "Pagos y datos privados",
      content: (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <BankingPanel
            creatorId={creator.id}
            banking={creator.banking}
            accounts={creator.bankAccounts}
            methods={creator.paymentMethods}
          />
          <PersonalDataPanel
            creatorId={creator.id}
            hasRealName={creator.hasRealName}
            hasAddress={creator.hasAddress}
          />
        </div>
      ),
    },
  ];

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
                <EditCreatorButton creator={creator} categories={categories} />
              </>
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {creator.categories.map((c, i) => (
              <Badge key={c} tone={i === 0 ? "accent" : "neutral"} plain>
                {c}
              </Badge>
            ))}
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
          hint={`${related.length} campaña${related.length === 1 ? "" : "s"} · ${piezas.length} piezas`}
          delta={trend(serieVistas) ?? undefined}
          series={serieVistas}
        />
      </StatBand>

      <CreatorTabs pestanas={pestanas} />
    </div>
  );
}

/** Sus campañas, con lo que tiene en cada una. */
function ListaCampanas({
  campanas,
  creator,
  companies,
}: {
  campanas: Campaign[];
  creator: Creator;
  companies: Company[];
}) {
  return (
    <ListBox>
      {campanas.map((campaign) => {
        const suyas = campaign.deliverables.filter((d) => d.creatorId === creator.id);
        const vivas = suyas.filter((d) => d.status !== "cancelado");
        const pendientes = suyas.filter((d) => d.status === "pendiente").length;
        const pactado = vivas.reduce((s, d) => s + creatorPayout(d, campaign), 0);
        const cliente = companies.find((c) => c.id === campaign.companyId);
        const estado = CAMPAIGN_STATUS[campaign.status];

        return (
          <ListRow
            key={campaign.id}
            // A su ficha dentro de la campaña: sus piezas, sus fechas y quién
            // lo lleva, que es lo que se quiere ver desde aquí.
            href={`/campanas/${campaign.id}/creador/${creator.id}`}
            leading={
              <RowIcon>
                <Megaphone size={17} strokeWidth={1.75} />
              </RowIcon>
            }
            title={campaign.name}
            subtitle={[
              cliente?.name,
              `${suyas.length} pieza${suyas.length === 1 ? "" : "s"}`,
              pendientes ? `${pendientes} por entregar` : null,
              campaign.endDate ? `hasta el ${formatDate(campaign.endDate)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              <span className="flex items-center gap-3">
                <span className="hidden text-right sm:block">
                  <span className="tabular block text-[14px] font-semibold">
                    {formatMoney(pactado, campaign.currency)}
                  </span>
                  <span className="block text-[11.5px] text-[var(--text-subtle)]">pactado</span>
                </span>
                <Badge tone={estado.tone}>{estado.label}</Badge>
              </span>
            }
          />
        );
      })}
    </ListBox>
  );
}
