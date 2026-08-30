"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FolderOpen, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { SearchInput } from "@/components/shell/toolbar";
import { useCan } from "@/components/session-provider";
import type { DocSummary, Folder } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Primer nivel de las notas: los proyectos.
 *
 * En la base la tabla se llama `Folder` porque el modelo es un árbol de
 * carpetas anidables; de cara al equipo son «proyectos», que es como se habla
 * de ellos. Un rename de tabla no valía otra migración.
 */
export function ProjectsView({ projects, docs }: { projects: Folder[]; docs: DocSummary[] }) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_notas");

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<DocSummary[] | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const raices = projects.filter((p) => !p.parentId);
  const sueltas = docs.filter((d) => !d.folderId);

  /** Cuenta las notas del proyecto y de todos sus descendientes. */
  function totalDe(id: string): number {
    const hijos = projects.filter((p) => p.parentId === id);
    return (
      docs.filter((d) => d.folderId === id).length +
      hijos.reduce((suma, h) => suma + totalDe(h.id), 0)
    );
  }

  async function buscar(texto: string) {
    setBusqueda(texto);
    if (!texto.trim()) {
      setResultados(null);
      return;
    }
    const res = await fetch(`/api/notas?q=${encodeURIComponent(texto)}`);
    if (res.ok) setResultados(await res.json());
  }

  async function crearProyecto() {
    if (!nombre.trim()) {
      setError("Ponle nombre al proyecto.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch("/api/notas/carpetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombre.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el proyecto.");
      setNombre("");
      setAbierto(false);
      router.push(`/notas/proyecto/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Notas"
        description="Cada proyecto guarda sus documentos."
        actions={
          puedeEditar && (
            <Button variant="accent" size="lg" onClick={() => setAbierto(true)}>
              <Plus size={16} />
              Proyecto
            </Button>
          )
        }
      />

      {error && !abierto && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <SearchInput value={busqueda} onChange={buscar} placeholder="Buscar en todas las notas" />

      {/* Buscar salta la jerarquía: lo que quieres es la nota, no el proyecto. */}
      {resultados ? (
        <div>
          <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">
            {resultados.length === 0
              ? "Nada coincide."
              : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"}`}
          </p>
          {resultados.length > 0 && (
            <ListBox>
              {resultados.map((d) => (
                <NotaFila key={d.id} doc={d} proyectos={projects} />
              ))}
            </ListBox>
          )}
        </div>
      ) : raices.length === 0 && sueltas.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin proyectos"
          description="Agrupa las notas por cliente, por campaña o como te sirva."
          action={
            puedeEditar && (
              <Button variant="accent" onClick={() => setAbierto(true)}>
                <Plus size={16} />
                Crear proyecto
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {raices.length > 0 && (
            <ListBox>
              {raices.map((p) => {
                const hijos = projects.filter((h) => h.parentId === p.id).length;
                const total = totalDe(p.id);
                return (
                  <ListRow
                    key={p.id}
                    href={`/notas/proyecto/${p.id}`}
                    leading={
                      <RowIcon>
                        <FolderOpen size={17} strokeWidth={1.75} style={{ color: p.color }} />
                      </RowIcon>
                    }
                    title={p.name}
                    subtitle={
                      [
                        total === 0
                          ? "Sin notas"
                          : `${total} ${total === 1 ? "nota" : "notas"}`,
                        hijos > 0 ? `${hijos} ${hijos === 1 ? "subproyecto" : "subproyectos"}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    }
                  />
                );
              })}
            </ListBox>
          )}

          {sueltas.length > 0 && (
            <div>
              <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">Sin proyecto</p>
              <ListBox>
                {sueltas.map((d) => (
                  <NotaFila key={d.id} doc={d} proyectos={projects} />
                ))}
              </ListBox>
            </div>
          )}
        </div>
      )}

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        icon={FolderOpen}
        title="Nuevo proyecto"
        description="Un espacio para las notas de un cliente, una campaña o una temporada."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={crearProyecto} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Crear
            </Button>
          </>
        }
      >
        <Label htmlFor="proyecto-nombre">Nombre</Label>
        <Input
          id="proyecto-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crearProyecto()}
          placeholder="Campañas de verano"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-[12.5px] text-[var(--danger)]">{error}</p>
        )}
      </Modal>
    </div>
  );
}

/** Una nota en una lista, con el proyecto al que pertenece. */
export function NotaFila({ doc, proyectos }: { doc: DocSummary; proyectos: Folder[] }) {
  const suyo = proyectos.find((p) => p.id === doc.folderId);

  return (
    <ListRow
      href={`/notas/${doc.id}`}
      leading={
        <RowIcon>
          <FileText size={17} strokeWidth={1.75} />
        </RowIcon>
      }
      title={doc.title}
      subtitle={doc.excerpt || "Vacía"}
      trailing={
        <span className="flex items-center gap-3">
          {suyo && (
            <span className="hidden text-[12px] text-[var(--text-subtle)] sm:block">
              {suyo.name}
            </span>
          )}
          <span className="hidden text-[12px] text-[var(--text-subtle)] md:block">
            {formatDate(doc.updatedAt)}
          </span>
        </span>
      }
    />
  );
}

