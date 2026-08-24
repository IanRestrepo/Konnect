import { requirePermission } from "@/lib/session";
import { SettingsView } from "@/app/configuracion/settings-view";

export const metadata = { title: "Configuración — Konnect" };

export default async function ConfiguracionPage() {
  await requirePermission("gestionar_ajustes");
  return <SettingsView />;
}
