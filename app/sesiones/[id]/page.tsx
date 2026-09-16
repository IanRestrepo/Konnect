import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getCampaign, getCreator } from "@/lib/data";
import { getCollabSession, seedRequirementsFromCampaign } from "@/lib/store";
import { SessionDetail } from "@/app/sesiones/[id]/session-detail";
import { puedeVerCampana, soloLoSuyo } from "@/lib/campaign-access";

export const metadata = { title: "Sesión — Konnect" };

export default async function SesionPage({ params }: { params: Promise<{ id: string }> }) {
  const cuenta = await requirePermission("ver_sesiones");
  const { id } = await params;

  let session = await getCollabSession(id);
  if (!session) notFound();

  // El enlace se arma en el servidor: leer window durante el render rompía la
  // hidratación y dejaba la página sin botones.
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const portalUrl = host ? `${protocolo}://${host}/portal/${id}` : `/portal/${id}`;

  const [campaign, creator] = await Promise.all([
    session.campaignId ? getCampaign(session.campaignId) : null,
    session.creatorId ? getCreator(session.creatorId) : null,
  ]);

  // El acuerdo se mantiene solo: las piezas pactadas que aún no tienen su
  // petición la reciben al abrir la sesión. Sustituye al botón «Traer del
  // acuerdo», que había que acordarse de pulsar. No duplica nada.
  if (session.campaignId && session.creatorId && campaign) {
    const nuevas = await seedRequirementsFromCampaign(id, session.campaignId, session.creatorId);
    if (nuevas > 0) {
      const fresca = await getCollabSession(id);
      if (fresca) session = fresca;
    }
  }

  /**
   * La sesión hereda el acceso de su campaña. Una sesión suelta —sin campaña,
   * o con la campaña ya borrada— no la ve nadie con la restricción puesta: no
   * hay a qué asignación mirar, y darla por buena sería la vía por la que se
   * cuelan las que no le tocan.
   */
  if (soloLoSuyo(cuenta) && !(campaign && puedeVerCampana(cuenta, campaign))) {
    notFound();
  }

  return (
    <SessionDetail
      session={session}
      portalUrl={portalUrl}
      campaignName={campaign?.name ?? null}
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
