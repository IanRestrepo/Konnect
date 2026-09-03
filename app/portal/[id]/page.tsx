import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PORTAL_COOKIE, readPortalToken } from "@/lib/portal";
import { DEVICE_COOKIE, readDeviceToken } from "@/lib/portal-guard";
import { getCollabSession } from "@/lib/store";
import { getCampaign } from "@/lib/data";
import { creatorPayout } from "@/lib/pricing";
import { PortalGate } from "@/app/portal/[id]/portal-gate";
import { PortalView, type PortalPago } from "@/app/portal/[id]/portal-view";
import { tareaLabel } from "@/lib/socials";

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
    // Si este dispositivo ya entró y eligió PIN, se le piden los cuatro
    // dígitos en vez del código largo, que ya no tiene a mano.
    const device = await readDeviceToken(store.get(DEVICE_COOKIE)?.value);
    const conocido =
      device?.sessionId === id
        ? session.accesses.find((a) => a.id === device.accessId)
        : null;

    return (
      <PortalGate
        sessionId={id}
        arranque={conocido && conocido.hasPin && !conocido.revoked ? "pin" : "codigo"}
      />
    );
  }

  // El acceso pudo revocarse después de emitir el token.
  const acceso = session.accesses.find((a) => a.id === portal.accessId);
  if (!acceso || acceso.revoked) {
    return <PortalGate sessionId={id} aviso="Ese acceso ya no está activo. Pide uno nuevo." />;
  }

  /**
   * El pago solo se le muestra al creador, y solo el suyo: nunca lo pactado
   * con el resto ni lo que la agencia le cobra al cliente.
   */
  let pago: PortalPago | null = null;

  if (portal.role === "creador" && session.campaignId && session.creatorId) {
    const campaign = await getCampaign(session.campaignId);
    const suyos = campaign?.deliverables.filter((d) => d.creatorId === session.creatorId) ?? [];

    if (campaign && suyos.length > 0) {
      const total = suyos.reduce((s, d) => s + creatorPayout(d, campaign), 0);

      // El estado global es el del menos avanzado: no se anuncia «pagado»
      // mientras quede una pieza sin pagar.
      const estado = suyos.every((d) => d.paymentStatus === "pagado")
        ? "pagado"
        : suyos.some((d) => d.paymentStatus === "aprobado")
          ? "aprobado"
          : "pendiente";

      pago = {
        total,
        moneda: campaign.currency,
        estado,
        piezas: suyos.map((d) => ({
          // Con el nombre de la red, no el genérico: al creador se le encargó
          // «Mención dentro de un video», y leer «Fracción publicitaria» —o
          // peor, «Reel / Short»— le hace dudar de qué tiene que entregar.
          titulo: d.title ?? tareaLabel(d.platform, d.type),
          importe: creatorPayout(d, campaign),
          estado: d.paymentStatus,
        })),
      };
    }
  }

  return (
    <PortalView
      sessionId={id}
      name={session.name}
      role={portal.role}
      label={portal.label}
      canUpload={acceso.canUpload && session.status === "abierta"}
      requirements={session.requirements}
      items={session.items}
      pago={pago}
    />
  );
}
