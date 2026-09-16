import { requirePermission } from "@/lib/session";
import { getCampaigns, getCompanies, getCreator } from "@/lib/data";
import { construirMediaKit } from "@/lib/blackbull/datos";
import { generarMediaKit } from "@/lib/blackbull/motor";

export const dynamic = "force-dynamic";
// BlackBull usa `node:fs` para las fuentes: no corre en el runtime edge.
export const runtime = "nodejs";

/** Un nombre de archivo sin tildes ni símbolos, que ningún sistema rompa. */
function nombreArchivo(nombre: string, conTarifas: boolean): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `media-kit-${base || "creador"}${conTarifas ? "-tarifas" : ""}.pdf`;
}

/**
 * El media kit de un creador, en PDF, generado con BlackBull Engine.
 *
 * `?tarifas=1` añade la página de precios al cliente. Sin ella es el documento
 * de presentación, que se puede mandar antes de hablar de dinero.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_creadores");
  const { id } = await params;
  const conTarifas = new URL(request.url).searchParams.get("tarifas") === "1";

  const [creator, campaigns, companies] = await Promise.all([
    getCreator(id),
    getCampaigns(),
    getCompanies(),
  ]);
  if (!creator) {
    return Response.json({ error: "Creador no encontrado." }, { status: 404 });
  }

  const pdf = await generarMediaKit(construirMediaKit(creator, campaigns, companies, { conTarifas }));

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // En línea: se abre en el visor del navegador, y desde ahí se descarga
      // o se comparte. Con el nombre ya puesto para cuando se guarde.
      "Content-Disposition": `inline; filename="${nombreArchivo(creator.name, conTarifas)}"`,
      "Cache-Control": "no-store",
    },
  });
}
