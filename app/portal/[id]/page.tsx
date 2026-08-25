import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PORTAL_COOKIE, readPortalToken } from "@/lib/portal";
import { getCollabSession } from "@/lib/store";
import { getCreator } from "@/lib/data";
import { PortalGate } from "@/app/portal/[id]/portal-gate";
import { PortalView } from "@/app/portal/[id]/portal-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portal — Konnect", robots: { index: false, follow: false } };

/**
 * Portal externo de una sesión. No hay cuenta: se entra con el código que la
 * agencia repartió. Fuera de la sesión no se expone absolutamente nada.
 */
export default async function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getCollabSession(id);
  if (!session) notFound();

  const store = await cookies();
  const portal = await readPortalToken(store.get(PORTAL_COOKIE)?.value);

  // Sin token válido para esta sesión, solo se ve la pantalla del código.
  if (!portal || portal.sessionId !== id) {
    return <PortalGate sessionId={id} />;
  }

  // El acceso pudo revocarse después de emitir el token.
  const acceso = session.accesses.find((a) => a.id === portal.accessId);
  if (!acceso || acceso.revoked) {
    return <PortalGate sessionId={id} aviso="Ese acceso ya no está activo. Pide uno nuevo." />;
  }

  const creator = session.creatorId ? await getCreator(session.creatorId) : null;

  return (
    <PortalView
      sessionId={id}
      name={session.name}
      notes={session.notes}
      status={session.status}
      role={portal.role}
      label={portal.label}
      canUpload={acceso.canUpload && session.status === "abierta"}
      items={session.items}
      creator={
        session.showMetrics && creator
          ? {
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
