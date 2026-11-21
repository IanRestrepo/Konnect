import { PageTitle } from "@/components/ui/section";
import { requirePermission } from "@/lib/session";
import { ContractForm } from "./contract-form";

export const metadata = { title: "Contratos — Konnect" };

export default async function ContratosPage() {
  await requirePermission("ver_contratos");
  return (
    <div className="space-y-6">
      <PageTitle title="Contratos" description="Genera un contrato en PDF con una empresa o un influencer." />
      <ContractForm />
    </div>
  );
}
