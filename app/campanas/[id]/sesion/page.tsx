import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getCampaign, getCompany, getCreators } from "@/lib/data";
import { getCampaignMaster, listSessions, seedRequirementsFromCampaign } from "@/lib/store";
import { puedeVerCampana } from "@/lib/campaign-access";
import { enlacePersonal, portalBase } from "@/lib/portal-link";
import {
  MasterSessionView,
  type SesionFila,
} from "@/app/campanas/[id]/sesion/master-session-view";

export const metadata = { title: "Sesión maestra — Konnect" };

/**
 * La sesión maestra de una campaña.
 *
 * Cada creador sigue teniendo su propia sesión —su enlace, su checklist, sus
 * entregas, y nadie ve lo de los demás—, pero la agencia ya no tiene que
 * abrirlas una a una para saber cómo va la campaña ni para pedirles a todos lo
 * mismo. Aquí se ven todas juntas, y lo que se manda desde aquí «a todas»
 * llega a cada una.
 */
export default async function SesionMaestraPage({ params }: { params: Promise<{ id: string }> }) {
  const cuenta = await requirePermission("ver_campanas");
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  if (!puedeVerCampana(cuenta, campaign)) notFound();

  const [company, creators, sesionesAntes, master] = await Promise.all([
    getCompany(campaign.companyId),
    getCreators(),
    listSessions(),
    getCampaignMaster(id),
  ]);

  // El acuerdo se mantiene solo: cada pieza pactada tiene su petición en el
  // checklist de su creador sin que nadie pulse nada. No duplica.
  const nuevas = await Promise.all(
    sesionesAntes
      .filter((s) => s.campaignId === id && s.creatorId)
      .map((s) => seedRequirementsFromCampaign(s.id, id, s.creatorId!)),
  );
  const todas = nuevas.some((n) => n > 0) ? await listSessions() : sesionesAntes;

  const porId = new Map(creators.map((c) => [c.id, c]));

  const filas: SesionFila[] = await Promise.all(
    todas
      .filter((s) => s.campaignId === id)
      .map(async (s) => {
        const creador = s.creatorId ? porId.get(s.creatorId) : undefined;
        const acceso = s.accesses.find((a) => a.role === "creador" && !a.revoked) ?? null;
        const base = await portalBase(s.id);
        return {
          session: s,
          creator: creador
            ? { id: creador.id, name: creador.name, avatarUrl: creador.avatarUrl }
            : null,
          // El enlace se arma aquí: la dirección del portal depende de las
          // cabeceras de la petición, que en el navegador no existen.
          enlace: acceso ? enlacePersonal(base, acceso.code) : null,
          tienePin: acceso?.hasPin ?? false,
        };
      }),
  );

  // Por nombre: con diez creadores, encontrar a uno por orden de alta es
  // adivinar.
  filas.sort((a, b) => (a.creator?.name ?? a.session.name).localeCompare(b.creator?.name ?? b.session.name));

  return (
    <MasterSessionView
      campaignId={campaign.id}
      campaignName={campaign.name}
      companyName={company?.name ?? null}
      filas={filas}
      comunes={master.requirements}
      materiales={master.materials}
    />
  );
}
