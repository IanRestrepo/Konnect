"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  FolderOpen,
  FolderPlus,
  LoaderCircle,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { DocSummary, Folder } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** Segundo nivel: dentro de un proyecto. Sus notas y sus subproyectos. */
export function ProjectView({
  proyecto,
  ruta,
  subproyectos,
  docs,
}: {
  proyecto: Folder;
  ruta: { id: string; name: string }[];
  subproyectos: Folder[];
  docs: DocSummary[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_notas");

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subOpen, setSubOpen] = useState(false);
  const [nombre, setNombre] = useState("");

  async function crearNota() {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: proyecto.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la nota.");
      router.push(`/notas/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setOcupado(false);
    }
  }

  async function crearSub() {
    if (!nombre.trim()) {
      setError("Ponle nombre al subproyecto.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch("/api/notas/carpetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombre.trim(), parentId: proyecto.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el subproyecto.");
      setNombre("");
      setSubOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  }

  async function borrarProyecto() {
    const aviso =
      docs.length > 0 || subproyectos.length > 0
        ? `¿Borrar «${proyecto.name}»? Sus subproyectos también se borran; las notas no, quedan sin proyecto.`
        : `¿Borrar «${proyecto.name}»?`;
    if (!window.confirm(aviso)) return;

    const res = await fetch(`/api/notas/carpetas?id=${proyecto.id}`, { method: "DELETE" });
    if (res.ok) router.push("/notas");
  }

  return (
    <div className="space-y-5">
      {/* Migas: con subproyectos, saber dónde estás importa. */}
      <nav className="flex flex-wrap items-center gap-1 text-[13px] text-[var(--text-muted)]">
        <Link href="/notas" className="transition hover:text-[var(--text)]">
          Notas
        </Link>
        {ruta.map((paso, i) => (
          <span key={paso.id} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-[var(--text-subtle)]" />
            {i === ruta.length - 1 ? (
              <span className="text-[var(--text)]">{paso.name}</span>
            ) : (
              <Link
                href={`/notas/proyecto/${paso.id}`}
                className="transition hover:text-[var(--text)]"
              >
                {paso.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <PageTitle
        title={proyecto.name}
        description={
          docs.length === 0
            ? "Sin notas todavía."
            : `${docs.length} ${docs.length === 1 ? "nota" : "notas"}`
        }
        actions={
          puedeEditar && (
            <span className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={() => setSubOpen(true)}>
                <FolderPlus size={16} />
                Subproyecto
              </Button>
              <Button variant="accent" size="lg" onClick={crearNota} disabled={ocupado}>
                {ocupado ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
                Nota
              </Button>
            </span>
          )
        }
      />

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {subproyectos.length > 0 && (
        <div>
          <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">Subproyectos</p>
          <ListBox>
            {subproyectos.map((s) => (
              <ListRow
                key={s.id}
                href={`/notas/proyecto/${s.id}`}
                leading={
                  <RowIcon>
                    <FolderOpen size={17} strokeWidth={1.75} style={{ color: s.color }} />
                  </RowIcon>
                }
                title={s.name}
                subtitle={
                  s.docCount === 0
                    ? "Sin notas"
                    : `${s.docCount} ${s.docCount === 1 ? "nota" : "notas"}`
                }
              />
            ))}
          </ListBox>
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin notas"
          description="Guarda aquí ideas, acuerdos y todo lo que conviene no perder."
          action={
            puedeEditar && (
              <Button variant="accent" onClick={crearNota}>
                <Plus size={16} />
                Crear nota
              </Button>
            )
          }
        />
      ) : (
        <div>
          {subproyectos.length > 0 && (
            <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">Notas</p>
          )}
          <ListBox>
            {docs.map((d) => (
              <ListRow
                key={d.id}
                href={`/notas/${d.id}`}
                leading={
                  <RowIcon>
                    <FileText size={17} strokeWidth={1.75} />
                  </RowIcon>
                }
                title={d.title}
                subtitle={d.excerpt || "Vacía"}
                trailing={
                  <span className="hidden text-[12px] text-[var(--text-subtle)] sm:block">
                    {formatDate(d.updatedAt)}
                  </span>
                }
              />
            ))}
          </ListBox>
        </div>
      )}

      {puedeEditar && (
        <button
          onClick={borrarProyecto}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-subtle)] transition hover:text-[var(--danger)]"
        >
          <Trash2 size={13} />
          Borrar proyecto
        </button>
      )}

      <Modal
        open={subOpen}
        onClose={() => setSubOpen(false)}
        icon={FolderOpen}
        title="Nuevo subproyecto"
        description={`Dentro de «${proyecto.name}».`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={crearSub} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Crear
            </Button>
          </>
        }
      >
        <Label htmlFor="sub-nombre">Nombre</Label>
        <Input
          id="sub-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crearSub()}
          placeholder="Guiones"
          autoFocus
        />
      </Modal>
    </div>
  );
}
