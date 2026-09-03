import { requirePermission } from "@/lib/session";
import { listarBitacora } from "@/lib/audit";
import { listUsers } from "@/lib/store";
import { AuditView } from "@/app/bitacora/audit-view";

export const metadata = { title: "Bitácora — Konnect" };

export default async function BitacoraPage() {
  await requirePermission("ver_bitacora");

  const [entradas, usuarios] = await Promise.all([listarBitacora({ limite: 200 }), listUsers()]);

  return (
    <AuditView
      entradas={entradas}
      actores={usuarios.map((u) => ({ id: u.id, name: u.name }))}
    />
  );
}
