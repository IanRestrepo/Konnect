import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getCampaign, getCreator } from "@/lib/data";
import { getCollabSession } from "@/lib/store";
import { SessionDetail } from "@/app/sesiones/[id]/session-detail";

export const metadata = { title: "Sesión — Konnect" };

export default async function SesionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_sesiones");
  const { id } = await params;

  const session = await getCollabSession(id);
  if (!session) notFound();

  const [campaign, creator] = await Promise.all([
    session.campaignId ? getCampaign(session.campaignId) : null,
    session.creatorId ? getCreator(session.creatorId) : null,
  ]);

  return (
    <SessionDetail
      session={session}
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
