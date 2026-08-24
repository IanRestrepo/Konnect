import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Megaphone, Pencil } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ContactsPanel } from "@/components/companies/contacts-panel";
import { campaignMetrics, companyCampaigns, getCampaigns, getCompany } from "@/lib/data";
import { CAMPAIGN_OBJECTIVE, CAMPAIGN_STATUS, COMPANY_STATUS } from "@/lib/labels";
import { companyInvestmentSeries, trend, viewsSeries } from "@/lib/series";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_empresas");
  const { id } = await params;
  const [company, campaigns] = await Promise.all([getCompany(id), getCampaigns()]);
  if (!company) notFound();

  const own = companyCampaigns(campaigns, company.id);
  const status = COMPANY_STATUS[company.status];
  const invested = own.reduce((s, c) => s + c.budget, 0);
  const views = own.reduce((s, c) => s + campaignMetrics(c).views, 0);
  const serieInversion = companyInvestmentSeries(own);
  const serieVistas = viewsSeries(own);
  const socials = Object.entries(company.socials).filter(([, v]) => Boolean(v));

  return (
    <div className="space-y-7">
      <Link
        href="/empresas"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} />
        Empresas
      </Link>

      <div className="flex items-start gap-4">
        <Avatar name={company.name} size={64} rounded="lg" />
        <div className="min-w-0 flex-1">
          <PageTitle
            title={company.name}
            description={company.industry}
            actions={
              <>
                {company.website && (
                  <Link href={company.website} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="icon-lg" aria-label="Abrir sitio web">
                      <ExternalLink size={17} strokeWidth={1.75} />
                    </Button>
                  </Link>
                )}
                <Button variant="primary" size="lg">
                  Editar
                  <Pencil size={15} />
                </Button>
              </>
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {socials.map(([key, value]) => (
              <Badge key={key} plain>
                {SOCIAL_LABEL[key] ?? key} {value}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <StatBand>
        <Stat label="Campañas" value={String(own.length)} />
        <Stat
          label="Inversión acumulada"
          value={formatMoney(invested)}
          series={serieInversion}
        />
        <Stat
          label="Vistas generadas"
          value={formatCompact(views)}
          delta={trend(serieVistas) ?? undefined}
          series={serieVistas}
        />
        <Stat
          label="Ticket promedio"
          value={own.length ? formatMoney(invested / own.length) : "—"}
        />
      </StatBand>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section>
          <SectionLabel>Campañas del cliente</SectionLabel>
          {own.length === 0 ? (
            <Card className="px-5 py-6 text-[13px] text-[var(--text-muted)]">
              Todavía no tiene campañas registradas.
            </Card>
          ) : (
            <ListBox>
              {own.map((campaign) => {
                const st = CAMPAIGN_STATUS[campaign.status];
                const metrics = campaignMetrics(campaign);
                return (
                  <ListRow
                    key={campaign.id}
                    href={`/campanas/${campaign.id}`}
                    leading={
                      <RowIcon>
                        <Megaphone size={17} strokeWidth={1.75} />
                      </RowIcon>
                    }
                    title={campaign.name}
                    subtitle={`${CAMPAIGN_OBJECTIVE[campaign.objective]} · ${formatDate(campaign.startDate)}`}
                    trailing={
                      <span className="flex items-center gap-4">
                        <span className="hidden text-right sm:block">
                          <span className="tabular block text-[14px] font-semibold">
                            {formatCompact(metrics.views)}
                          </span>
                          <span className="block text-[11.5px] text-[var(--text-subtle)]">
                            {formatMoney(campaign.budget, campaign.currency)}
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

        <div className="space-y-6">
          <ContactsPanel companyId={company.id} contacts={company.contacts} />

          <Card>
            <CardHeader>
              <CardTitle>Notas internas</CardTitle>
            </CardHeader>
            <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              {company.notes || "Sin notas."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
