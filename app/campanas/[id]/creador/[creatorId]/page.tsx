import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getCampaign, getCompany, getCreator } from "@/lib/data";
import { listDeliverableKinds, listSessions, listUsers } from "@/lib/store";
import { puedeVerCampana } from "@/lib/campaign-access";
import { CampaignCreatorView } from "@/app/campanas/[id]/creador/[creatorId]/campaign-creator-view";

/**
 * La ficha de un creador dentro de una campaña.
 *
 * La ficha de `/creadores/[id]` cuenta quién es y cuánto cobra en general; la
 * pantalla de campaña cuenta cuántas piezas hay en total. Faltaba el cruce, que
 * es con lo que se trabaja de verdad a mitad de mes: qué le encargamos a este,
 * para cuándo, cómo va y quién responde por él.
 */
export default async function CampanaCreadorPage({
  params,
}: {
  params: Promise<{ id: string; creatorId: string }>;
}) {
  const session = await requirePermission("ver_campanas");
  const { id, creatorId } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  // Una campaña que no es suya no existe para él: 404 y no 403, que ya
  // confirmaría que la campaña está ahí.
  if (!puedeVerCampana(session, campaign)) notFound();

  const creator = await getCreator(creatorId);
  if (!creator) notFound();

  // Sin piezas no participa en esta campaña: la ficha no tendría de qué hablar.
  const deliverables = campaign.deliverables.filter((d) => d.creatorId === creatorId);
  if (deliverables.length === 0) notFound();

  const [company, todasSesiones, usuarios, kinds] = await Promise.all([
    getCompany(campaign.companyId),
    listSessions(),
    listUsers(),
    listDeliverableKinds(),
  ]);

  const sesion =
    todasSesiones.find((s) => s.campaignId === campaign.id && s.creatorId === creatorId) ?? null;

  // Solo las cuentas activas: nombrar encargado a quien ya no entra deja la
  // ficha diciendo que responde quien no responde.
  const empleados = usuarios
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }));

  return (
    <CampaignCreatorView
      campaign={campaign}
      creator={creator}
      companyName={company?.name ?? null}
      deliverables={deliverables}
      session={sesion}
      empleados={empleados}
      kinds={kinds}
    />
  );
}
