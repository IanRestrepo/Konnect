import { requirePermission } from "@/lib/session";
import { listDocs, listFolders } from "@/lib/store";
import { ProjectsView } from "@/app/notas/projects-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notas — Konnect" };

/** Primer nivel: los proyectos. Las notas se ven al entrar en uno. */
export default async function NotasPage() {
  await requirePermission("ver_notas");

  const [folders, docs] = await Promise.all([listFolders(), listDocs()]);

  return <ProjectsView projects={folders} docs={docs} />;
}
