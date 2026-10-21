import { requirePermission } from "@/lib/session";
import { campaignMetrics, getCampaigns, getCompanies, getCreators } from "@/lib/data";
import { CampaignsView } from "@/app/campanas/campaigns-view";
import { campanasVisibles } from "@/lib/campaign-access";
import { listUsers } from "@/lib/store";

export const metadata = { title: "Campañas — Konnect" };

export default async function CampanasPage() {
  const session = await requirePermission("ver_campanas");
  const [todas, companies, creators, usuarios] = await Promise.all([
    getCampaigns(),
    getCompanies(),
    getCreators(),
    listUsers(),
  ]);
  // Solo nombre y foto: lo demás de la cuenta no tiene por qué llegar al cliente.
  const persona = (id: string | null) => {
    const u = id ? usuarios.find((x) => x.id === id) : null;
    return u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl } : null;
  };

  // Con `solo_campanas_asignadas` la lista se recorta a las suyas; sin él,
  // devuelve todas y nada cambia respecto a antes.
  const campaigns = campanasVisibles(session, todas);

  const rows = campaigns.map((campaign) => ({
    campaign,
    metrics: campaignMetrics(campaign),
    company: companies.find((c) => c.id === campaign.companyId) ?? null,
    manager: persona(campaign.managerId),
    createdBy: persona(campaign.createdById),
    creators: Array.from(new Set(campaign.deliverables.map((d) => d.creatorId)))
      .map((id) => creators.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c)),
  }));

  return <CampaignsView rows={rows} />;
}
