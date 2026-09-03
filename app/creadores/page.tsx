import { requirePermission } from "@/lib/session";
import { getCampaigns, getCreators } from "@/lib/data";
import { listCreatorCategories } from "@/lib/store";
import { CreatorsView } from "@/app/creadores/creators-view";

export const metadata = { title: "Creadores — Konnect" };

export default async function CreadoresPage() {
  await requirePermission("ver_creadores");
  const [creators, campaigns, categories] = await Promise.all([
    getCreators(),
    getCampaigns(),
    listCreatorCategories(),
  ]);

  const campaignCount = Object.fromEntries(
    creators.map((creator) => [
      creator.id,
      campaigns.filter((c) => c.deliverables.some((d) => d.creatorId === creator.id)).length,
    ]),
  );

  return (
    <CreatorsView creators={creators} campaignCount={campaignCount} categories={categories} />
  );
}
