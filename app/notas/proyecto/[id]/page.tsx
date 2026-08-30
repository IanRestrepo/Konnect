import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { listDocs, listFolders } from "@/lib/store";
import { ProjectView } from "@/app/notas/proyecto/[id]/project-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proyecto = (await listFolders()).find((f) => f.id === id);
  return { title: `${proyecto?.name ?? "Proyecto"} — Konnect` };
}

/** Segundo nivel: las notas de un proyecto, y sus subproyectos. */
export default async function ProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ver_notas");
  const { id } = await params;

  const proyectos = await listFolders();
  const proyecto = proyectos.find((p) => p.id === id);
  if (!proyecto) notFound();

  const docs = await listDocs({ folderId: id });

  return (
    <ProjectView
      proyecto={proyecto}
      // La ruta de migas se arma subiendo por los padres.
      ruta={rutaDe(proyecto.id, proyectos)}
      subproyectos={proyectos.filter((p) => p.parentId === id)}
      docs={docs}
    />
  );
}

function rutaDe(id: string, todos: { id: string; name: string; parentId: string | null }[]) {
  const camino: { id: string; name: string }[] = [];
  let actual = todos.find((p) => p.id === id);

  while (actual) {
    camino.unshift({ id: actual.id, name: actual.name });
    actual = actual.parentId ? todos.find((p) => p.id === actual!.parentId) : undefined;
  }
  return camino;
}
