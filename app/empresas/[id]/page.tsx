import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Megaphone } from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ContactsPanel } from "@/components/companies/contacts-panel";
import { ContactCard } from "@/components/creators/contact-card";
import { LinkedNotes } from "@/components/notes/linked-notes";
import { EditCompanyButton } from "@/components/companies/edit-company-dialog";
import { campaignMetrics, companyCampaigns, getCampaigns, getCompany } from "@/lib/data";
import {
  CAMPAIGN_OBJECTIVE,
  CAMPAIGN_STATUS,
  COMPANY_CONTACT_SUGGESTIONS,
  COMPANY_STATUS,
} from "@/lib/labels";
import { companyInvestmentSeries, trend, viewsSeries } from "@/lib/series";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";
import { BackLink } from "@/components/ui/back-link";

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

/**
 * Enlace y texto corto de una red de la empresa.
 *
 * Se guarda lo que se pegó —a veces el @, a veces la dirección entera con
 * parámetros—, y enseñarlo tal cual llenaba la cabecera de URLs que además
 * había que copiar a mano. Aquí se abre con un clic y se lee solo el nombre.
 */
function enlaceRed(red: string, valor: string): { href: string; texto: string } {
  const v = valor.trim();
  let href = v;
  if (!/^https?:\/\//i.test(v)) {
    const limpio = v.replace(/^@/, "").replace(/^\/+/, "");
    href =
      red === "linkedin"
        ? `https://www.linkedin.com/${limpio.includes("/") ? limpio : `company/${limpio}`}`
        : red === "youtube"
          ? `https://youtube.com/@${limpio}`
          : red === "tiktok"
            ? `https://tiktok.com/@${limpio}`
            : `https://instagram.com/${limpio}`;
  }

  let texto = v;
  try {
    const partes = new URL(href).pathname.split("/").filter(Boolean);
    // En LinkedIn el nombre va después de «company» o «in»; el resto de la
    // ruta son pestañas de la página.
    const i = partes.findIndex((p) => ["company", "in", "c", "user"].includes(p));
    const nombre = i >= 0 ? partes[i + 1] : (partes.find((p) => p.startsWith("@")) ?? partes[0]);
    // Un canal de YouTube por id (UC…) no tiene nombre legible.
    if (partes[0] === "channel") texto = "Ver canal";
    else if (nombre) texto = nombre.startsWith("@") || red === "linkedin" ? nombre : `@${nombre}`;
  } catch {
    // Dirección rara: se enseña lo que se guardó.
  }
  return { href, texto };
}

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_empresas");
  const { id } = await params;
  const [company, campaigns] = await Promise.all([getCompany(id), getCampaigns()]);
  if (!company) notFound();

  const own = companyCampaigns(campaigns, company.id);
  const status = COMPANY_STATUS[company.status];
  const invested = own.reduce((s, c) => s + campaignMetrics(c).clientTotal, 0);
  const views = own.reduce((s, c) => s + campaignMetrics(c).views, 0);
  const serieInversion = companyInvestmentSeries(own);
  const serieVistas = viewsSeries(own);
  const socials = Object.entries(company.socials).filter(([, v]) => Boolean(v));

  return (
    <div className="space-y-7">
      <BackLink fallbackHref="/empresas" />

      <div className="flex items-start gap-4">
        {/* Una persona lleva avatar redondo, como la gente; una empresa, cuadrado. */}
        <Avatar name={company.name} size={64} rounded={company.kind === "persona" ? undefined : "lg"} />
        <div className="min-w-0 flex-1">
          <PageTitle
            title={company.name}
            description={
              company.kind === "persona"
                ? ["Persona natural", company.industry !== "Otro" ? company.industry : null]
                    .filter(Boolean)
                    .join(" · ")
                : company.industry
            }
            actions={
              <>
                {company.website && (
                  <Link href={company.website} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="icon-lg" aria-label="Abrir sitio web">
                      <ExternalLink size={17} strokeWidth={1.75} />
                    </Button>
                  </Link>
                )}
                <EditCompanyButton company={company} />
              </>
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {socials.map(([key, value]) => {
              const { href, texto } = enlaceRed(key, String(value));
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={href}
                  className="inline-flex h-6 max-w-64 items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] px-2.5 text-[12px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <span className="font-medium text-[var(--text)]">{SOCIAL_LABEL[key] ?? key}</span>
                  <span className="truncate">{texto}</span>
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              );
            })}
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
                            {formatMoney(metrics.clientTotal, campaign.currency)}
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
          <ContactCard
            endpoint={`/api/empresas/${company.id}/campos-contacto`}
            permiso="editar_empresas"
            desdeLabel="Cliente desde"
            email={company.email}
            phone={company.phone}
            createdAt={company.createdAt}
            fields={company.contactFields}
            sugerencias={COMPANY_CONTACT_SUGGESTIONS}
          />

          <LinkedNotes companyId={company.id} />

          <ContactsPanel
            endpoint={`/api/empresas/${company.id}/contactos`}
            permiso="editar_empresas"
            contacts={company.contacts}
          />

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
