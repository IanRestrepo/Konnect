import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PORTAL_COOKIE, puedeEntregar, puedeSubirMaterial, readPortalToken } from "@/lib/portal";
import { DEVICE_COOKIE, readDeviceToken } from "@/lib/portal-guard";
import { getCollabSession } from "@/lib/store";
import { getCampaign } from "@/lib/data";
import { creatorPayout } from "@/lib/pricing";
import { PortalGate } from "@/app/portal/[id]/portal-gate";
import { PortalView, type PortalPago } from "@/app/portal/[id]/portal-view";
import { piezaLabel } from "@/lib/socials";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Portal — Konnect",
  robots: { index: false, follow: false },
  // El enlace lleva la llave del acceso en la dirección. Sin esto, cualquier
  // enlace que se abra desde el portal —el video en YouTube, un documento— le
  // mandaría esa dirección a la otra página como procedencia.
  referrer: "no-referrer" as const,
};

/**
 * Portal externo de una sesión. No hay cuenta: se entra con el enlace personal
 * que manda la agencia y un PIN de cuatro dígitos. Fuera de la sesión no se
 * expone absolutamente nada.
 */
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acceso?: string | string[] }>;
}) {
  const { id } = await params;
  const { acceso: bruto } = await searchParams;
  const llave = Array.isArray(bruto) ? bruto[0] : bruto;

  const session = await getCollabSession(id);
  if (!session) notFound();

  const store = await cookies();
  const portal = await readPortalToken(store.get(PORTAL_COOKIE)?.value);

  // Sin token válido para esta sesión, solo se ve la puerta.
  if (!portal || portal.sessionId !== id) {
    // Sin el enlace, un dispositivo donde ya se entró puede seguir con el PIN:
    // es quien abre el portal desde un marcador.
    const device = await readDeviceToken(store.get(DEVICE_COOKIE)?.value);
    const conocido =
      device?.sessionId === id
        ? session.accesses.find((a) => a.id === device.accessId)
        : null;

    return (
      <PortalGate
        sessionId={id}
        llave={llave ?? null}
        arranque={
          llave ? "abriendo" : conocido && conocido.hasPin && !conocido.revoked ? "pin" : "sin-enlace"
        }
      />
    );
  }

  // El acceso pudo revocarse después de emitir el token.
  const acceso = session.accesses.find((a) => a.id === portal.accessId);
  if (!acceso || acceso.revoked) {
    return (
      <PortalGate
        sessionId={id}
        llave={null}
        arranque="sin-enlace"
        aviso="Ese acceso ya no está activo. Pídele a la agencia un enlace nuevo."
      />
    );
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
          titulo: d.title ?? piezaLabel(d.platform, d.type, d.customType),
          importe: creatorPayout(d, campaign),
          estado: d.paymentStatus,
          comprobante: d.paymentStatus === "pagado" ? d.receiptUrl : null,
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
      puedeEntregar={puedeEntregar({ role: portal.role, canUpload: acceso.canUpload }) && session.status === "abierta"}
      puedeSubirMaterial={
        puedeSubirMaterial({ role: portal.role, canUpload: acceso.canUpload }) &&
        session.status === "abierta"
      }
      requirements={session.requirements}
      items={session.items}
      pago={pago}
    />
  );
}
