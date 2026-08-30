import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getCampaign, getCampaigns, getCreator, getCreators } from "@/lib/data";
import { getCollabSession } from "@/lib/store";
import { SessionDetail } from "@/app/sesiones/[id]/session-detail";

export const metadata = { title: "Sesión — Konnect" };

export default async function SesionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_sesiones");
  const { id } = await params;

  const session = await getCollabSession(id);
  if (!session) notFound();

  // El enlace se arma en el servidor: leer window durante el render rompía la
  // hidratación y dejaba la página sin botones.
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const portalUrl = host ? `${protocolo}://${host}/portal/${id}` : `/portal/${id}`;

  const [campaign, creator, campanas, creadores] = await Promise.all([
    session.campaignId ? getCampaign(session.campaignId) : null,
    session.creatorId ? getCreator(session.creatorId) : null,
    // Para poder recolocar una sesión que se quedó sin campaña.
    getCampaigns(),
    getCreators(),
  ]);

  return (
    <SessionDetail
      session={session}
      portalUrl={portalUrl}
      campaignName={campaign?.name ?? null}
      campanas={campanas.map((c) => ({ id: c.id, name: c.name }))}
      creadores={creadores.map((c) => ({ id: c.id, name: c.name }))}
      creator={
        creator
          ? {
              id: creator.id,
              name: creator.name,
              handle: creator.handle,
              avatarUrl: creator.avatarUrl,
              subscribers: creator.subscribers,
              totalViews: creator.totalViews,
              videoCount: creator.videoCount,
            }
          : null
      }
    />
  );
}
