import { requirePermission } from "@/lib/session";
import { campaignMetrics, getCampaigns, getCompanies, getCreators } from "@/lib/data";
import { CampaignsView } from "@/app/campanas/campaigns-view";
import { campanasVisibles } from "@/lib/campaign-access";

export const metadata = { title: "Campañas — Konnect" };

export default async function CampanasPage() {
  const session = await requirePermission("ver_campanas");
  const [todas, companies, creators] = await Promise.all([
    getCampaigns(),
    getCompanies(),
    getCreators(),
  ]);

  // Con `solo_campanas_asignadas` la lista se recorta a las suyas; sin él,
  // devuelve todas y nada cambia respecto a antes.
  const campaigns = campanasVisibles(session, todas);

  const rows = campaigns.map((campaign) => ({
    campaign,
    metrics: campaignMetrics(campaign),
    company: companies.find((c) => c.id === campaign.companyId) ?? null,
    creators: Array.from(new Set(campaign.deliverables.map((d) => d.creatorId)))
      .map((id) => creators.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c)),
  }));

  return <CampaignsView rows={rows} />;
}
