import { requirePermission } from "@/lib/session";
import { campaignMetrics, getCampaigns, getCompanies } from "@/lib/data";
import { CompaniesView } from "@/app/empresas/companies-view";

export const metadata = { title: "Empresas — Konnect" };

export default async function EmpresasPage() {
  await requirePermission("ver_empresas");
  const [companies, campaigns] = await Promise.all([getCompanies(), getCampaigns()]);

  const stats = Object.fromEntries(
    companies.map((company) => {
      const own = campaigns.filter((c) => c.companyId === company.id);
      return [
        company.id,
        {
          campaigns: own.length,
          invested: own.reduce((s, c) => s + campaignMetrics(c).clientTotal, 0),
          views: own.reduce((s, c) => s + campaignMetrics(c).views, 0),
        },
      ];
    }),
  );

  return <CompaniesView companies={companies} stats={stats} />;
}
