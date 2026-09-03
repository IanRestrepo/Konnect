import { requirePermission } from "@/lib/session";
import { getCompanies, getCreators } from "@/lib/data";
import { listUsers } from "@/lib/store";
import { NewCampaignForm } from "@/app/campanas/nueva/new-campaign-form";

export const metadata = { title: "Nueva campaña — Konnect" };

export default async function NuevaCampanaPage() {
  const session = await requirePermission("editar_campanas");
  const [companies, creators, usuarios] = await Promise.all([
    getCompanies(),
    getCreators(),
    listUsers(),
  ]);

  return (
    <NewCampaignForm
      companies={companies}
      creators={creators}
      empleados={usuarios
        .filter((u) => u.active)
        .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))}
      // Quien la crea es el responsable por defecto: es lo que pasa nueve de
      // cada diez veces, y dejarlo vacío hace que nadie lo rellene nunca.
      responsablePorDefecto={session.userId}
    />
  );
}
