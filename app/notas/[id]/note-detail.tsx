"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  Megaphone,
  Pin,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Picker } from "@/components/ui/picker";
import { NoteEditor } from "@/components/notes/editor";
import { useCan } from "@/components/session-provider";
import type { Doc, Folder } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Referencia = { id: string; name: string; avatarUrl?: string | null };

/**
 * Una nota abierta.
 *
 * Guarda sola, con un respiro de segundo y medio: en un editor, un botón de
 * guardar es una forma de perder trabajo.
 */
export function NoteDetail({
  doc,
  folders,
  campaigns,
  creators,
  companies,
}: {
  doc: Doc;
  folders: Folder[];
  campaigns: Referencia[];
  creators: Referencia[];
  companies: Referencia[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_notas");

  const [titulo, setTitulo] = useState(doc.title);
  const [estado, setEstado] = useState<"quieto" | "guardando" | "guardado">("quieto");
  const [error, setError] = useState<string | null>(null);
  const [fijada, setFijada] = useState(doc.pinned);
  const [carpeta, setCarpeta] = useState(doc.folderId ?? "");

  const [campanas, setCampanas] = useState<string[]>(
    doc.links.map((l) => l.campaignId).filter((x): x is string => Boolean(x)),
  );
  const [creadores, setCreadores] = useState<string[]>(
    doc.links.map((l) => l.creatorId).filter((x): x is string => Boolean(x)),
  );
  const [empresas, setEmpresas] = useState<string[]>(
    doc.links.map((l) => l.companyId).filter((x): x is string => Boolean(x)),
  );

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guardar = useCallback(
    async (patch: Record<string, unknown>) => {
      setEstado("guardando");
      setError(null);
      try {
        const res = await fetch(`/api/notas/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `No se pudo guardar (error ${res.status}).`);
        }
        setEstado("guardado");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
        setEstado("quieto");
      }
    },
    [doc.id],
  );

  /** Agrupa los cambios seguidos en una sola escritura. */
  const guardarConRespiro = useCallback(
    (patch: Record<string, unknown>) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => guardar(patch), 1500);
    },
    [guardar],
  );

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  function guardarVinculos(
    siguienteCampanas = campanas,
    siguienteCreadores = creadores,
    siguienteEmpresas = empresas,
  ) {
    // Cada vínculo es una fila: la nota puede colgar de varias cosas a la vez.
    const links = [
      ...siguienteCampanas.map((id) => ({ campaignId: id, creatorId: null, companyId: null })),
      ...siguienteCreadores.map((id) => ({ campaignId: null, creatorId: id, companyId: null })),
      ...siguienteEmpresas.map((id) => ({ campaignId: null, creatorId: null, companyId: id })),
    ];
    guardar({ links });
  }

  function alternar(lista: string[], id: string, set: (v: string[]) => void) {
    const siguiente = lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
    set(siguiente);
    return siguiente;
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar «${doc.title}»? No se puede deshacer.`)) return;

    const res = await fetch(`/api/notas/${doc.id}`, { method: "DELETE" });
    if (res.ok) router.push("/notas");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/notas"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft size={15} />
          Notas
        </Link>

        <span className="flex items-center gap-2.5">
          <span className="text-[12px] text-[var(--text-subtle)]">
            {estado === "guardando" ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle size={12} className="animate-spin" />
                Guardando…
              </span>
            ) : estado === "guardado" ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--ok)]">
                <Check size={12} />
                Guardado
              </span>
            ) : (
              `Editada ${formatDate(doc.updatedAt)}`
            )}
          </span>

          {puedeEditar && (
            <>
              <button
                onClick={() => {
                  setFijada(!fijada);
                  guardar({ pinned: !fijada });
                }}
                aria-label={fijada ? "Quitar de fijadas" : "Fijar arriba"}
                title={fijada ? "Quitar de fijadas" : "Fijar arriba"}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-[var(--r-control)] transition",
                  fijada
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-subtle)] hover:bg-[var(--surface-2)]",
                )}
              >
                <Pin size={15} />
              </button>
              <button
                onClick={borrar}
                aria-label="Borrar nota"
                className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </span>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <input
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              guardarConRespiro({ title: e.target.value });
            }}
            disabled={!puedeEditar}
            placeholder="Sin título"
            className="mb-4 w-full border-0 bg-transparent text-[27px] font-semibold tracking-tight text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
          />

          <NoteEditor
            content={doc.content}
            editable={puedeEditar}
            onChange={(content, plainText) => guardarConRespiro({ content, plainText })}
          />
        </div>

        {/* ---------------- Vínculos ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carpeta</CardTitle>
            </CardHeader>
            <div className="px-4 pb-4">
              <Picker
                value={carpeta}
                onChange={(v) => {
                  setCarpeta(v);
                  guardar({ folderId: v || null });
                }}
                disabled={!puedeEditar}
                options={[
                  { id: "", label: "Sin carpeta" },
                  ...folders.map((f) => ({ id: f.id, label: f.name })),
                ]}
              />
            </div>
          </Card>

          <Grupo
            titulo="Campañas"
            icono={<Megaphone size={14} />}
            opciones={campanas}
            todas={campaigns}
            puedeEditar={puedeEditar}
            onAlternar={(id) => guardarVinculos(alternar(campanas, id, setCampanas))}
            enlace={(id) => `/campanas/${id}`}
          />

          <Grupo
            titulo="Creadores"
            icono={<Users size={14} />}
            opciones={creadores}
            todas={creators}
            puedeEditar={puedeEditar}
            onAlternar={(id) =>
              guardarVinculos(campanas, alternar(creadores, id, setCreadores))
            }
            enlace={(id) => `/creadores/${id}`}
            avatar
          />

          <Grupo
            titulo="Empresas"
            icono={<Megaphone size={14} />}
            opciones={empresas}
            todas={companies}
            puedeEditar={puedeEditar}
            onAlternar={(id) =>
              guardarVinculos(campanas, creadores, alternar(empresas, id, setEmpresas))
            }
            enlace={(id) => `/empresas/${id}`}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Un grupo de vínculos ---------------- */

function Grupo({
  titulo,
  icono,
  opciones,
  todas,
  puedeEditar,
  onAlternar,
  enlace,
  avatar,
}: {
  titulo: string;
  icono: React.ReactNode;
  opciones: string[];
  todas: Referencia[];
  puedeEditar: boolean;
  onAlternar: (id: string) => void;
  enlace: (id: string) => string;
  avatar?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const elegidas = todas.filter((t) => opciones.includes(t.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            {icono}
            {titulo}
          </span>
        </CardTitle>
        {puedeEditar && (
          <button
            onClick={() => setAbierto((v) => !v)}
            className="text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {abierto ? "Listo" : "Editar"}
          </button>
        )}
      </CardHeader>

      <div className="px-3 pb-3">
        {abierto ? (
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {todas.length === 0 ? (
              <p className="px-1 py-2 text-[12.5px] text-[var(--text-subtle)]">Nada que vincular.</p>
            ) : (
              todas.map((t) => {
                const activo = opciones.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => onAlternar(t.id)}
                    className="flex w-full items-center gap-2 rounded-[var(--r-chip)] px-2 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-2)]"
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded border transition",
                        activo
                          ? "border-transparent bg-[var(--solid)] text-[var(--solid-fg)]"
                          : "border-[var(--line-strong)]",
                      )}
                    >
                      {activo && <Check size={11} />}
                    </span>
                    {avatar && <Avatar src={t.avatarUrl ?? null} name={t.name} size={20} />}
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : elegidas.length === 0 ? (
          <p className="px-1 py-1 text-[12.5px] text-[var(--text-subtle)]">Sin vincular.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {elegidas.map((t) => (
              <Link key={t.id} href={enlace(t.id)}>
                <Badge>{t.name}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

