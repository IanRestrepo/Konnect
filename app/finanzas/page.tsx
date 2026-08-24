import { requirePermission } from "@/lib/session";
import { FinanceView } from "@/app/finanzas/finance-view";

export const metadata = { title: "Finanzas — Konnect" };

export default async function FinanzasPage() {
  await requirePermission("ver_finanzas");
  return <FinanceView />;
}
