import { requirePermission } from "@/lib/session";
import { getCompanies, getCreators } from "@/lib/data";
import { NewCampaignForm } from "@/app/campanas/nueva/new-campaign-form";

export const metadata = { title: "Nueva campaña — Konnect" };

export default async function NuevaCampanaPage() {
  await requirePermission("editar_campanas");
  const [companies, creators] = await Promise.all([getCompanies(), getCreators()]);
  return <NewCampaignForm companies={companies} creators={creators} />;
}
