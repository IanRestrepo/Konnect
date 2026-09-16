import { requirePermission } from "@/lib/session";
import { getCampaigns } from "@/lib/data";
import { listSessions } from "@/lib/store";
import { SessionsView } from "@/app/sesiones/sessions-view";
import { campanasVisibles, sesionesVisibles } from "@/lib/campaign-access";

export const metadata = { title: "Sesiones — Konnect" };

export default async function SesionesPage() {
  const cuenta = await requirePermission("ver_sesiones");
  const [todas, campaigns] = await Promise.all([listSessions(), getCampaigns()]);

  // La sesión hereda de su campaña: quien no puede ver el trabajo tampoco sus
  // entregas.
  const sessions = sesionesVisibles(cuenta, todas, campaigns);

  return (
    <SessionsView
      sessions={sessions}
      campaigns={campanasVisibles(cuenta, campaigns).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      }))}
    />
  );
}
