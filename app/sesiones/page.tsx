import { requirePermission } from "@/lib/session";
import { getCampaigns, getCreators } from "@/lib/data";
import { listSessions } from "@/lib/store";
import { SessionsView } from "@/app/sesiones/sessions-view";

export const metadata = { title: "Sesiones — Konnect" };

export default async function SesionesPage() {
  await requirePermission("ver_sesiones");
  const [sessions, campaigns, creators] = await Promise.all([
    listSessions(),
    getCampaigns(),
    getCreators(),
  ]);

  return (
    <SessionsView
      sessions={sessions}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
      creators={creators.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
