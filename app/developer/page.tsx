import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isDeveloper } from "@/lib/permissions";
import { getDisabledModules, listAnnouncements, listRoles } from "@/lib/store";
import { DeveloperView } from "@/app/developer/developer-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Developer — Konnect", robots: { index: false, follow: false } };

export default async function DeveloperPage() {
  const session = await requireSession();

  // Para cualquiera que no sea el desarrollador, esta página no existe.
  if (!isDeveloper(session.permissions)) notFound();

  const [announcements, disabled, roles] = await Promise.all([
    listAnnouncements(),
    getDisabledModules(),
    listRoles(),
  ]);

  return (
    <DeveloperView
      announcements={announcements}
      disabled={disabled}
      roles={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
    />
  );
}
