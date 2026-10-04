"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Link2, LoaderCircle, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { CreatorChannel } from "@/lib/types";
import { formatCompact } from "@/lib/utils";

const SUGERENCIAS = ["Secundario", "Shorts", "Clips", "En vivo", "Vlogs", "Español"];

const MAX_ETIQUETAS = 8;

/**
 * Canales del creador: el principal y los adicionales.
 *
 * Cada canal lleva sus etiquetas, porque cada uno suele ir de una cosa: el
 * principal de Roblox, el segundo de gameplays, el tercero de Minecraft. Las
 * categorías de la ficha solo describían al principal, y a la hora de elegir
 * canal para una campaña no había forma de saber de qué iba cada uno.
 */
export function ChannelsPanel({
  creatorId,
  principal,
  channels,
  sugerencias = [],
}: {
  creatorId: string;
  principal: {
    name: string;
    handle: string;
    avatarUrl: string | null;
    subscribers: number;
    channelUrl: string;
    /** Las categorías de la ficha: son las etiquetas del canal principal. */
    categories: string[];
  };
  channels: CreatorChannel[];
  /** El catálogo de categorías, para proponer etiquetas. */
  sugerencias?: string[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState(SUGERENCIAS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Canal que se está editando, con su borrador. */
  const [editando, setEditando] = useState<{ id: string; handle: string; label: string; tags: string[] } | null>(
    null,
  );

  async function añadir() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/canales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, label, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo añadir el canal.");
      setUrl("");
      setTags([]);
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!editando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/canales`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal: editando.id, label: editando.label, tags: editando.tags }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el canal.");
      setEditando(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(canal: CreatorChannel) {
    if (!window.confirm(`¿Quitar el canal ${canal.handle || canal.label}? Se borran también sus tarifas.`)) {
      return;
    }
    setBorrando(canal.id);
    try {
      await fetch(`/api/creadores/${creatorId}/canales?canal=${canal.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBorrando(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Canales</CardTitle>
          {puedeEditar && (
            <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
              <Plus size={14} />
              Añadir
            </Button>
          )}
        </CardHeader>

        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {/* El principal siempre encabeza y no se puede quitar desde aquí. */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar src={principal.avatarUrl} name={principal.name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {principal.name}
                <span className="ml-2 text-[11.5px] font-normal text-[var(--text-subtle)]">
                  principal
                </span>
              </p>
              <p className="truncate text-[11.5px] text-[var(--text-subtle)]">
                {principal.handle} · {formatCompact(principal.subscribers)} subs
              </p>
              <Etiquetas tags={principal.categories} />
            </div>
            {principal.channelUrl && (
              <Link
                href={principal.channelUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[var(--text-subtle)] transition hover:text-[var(--accent)]"
                aria-label="Abrir canal principal"
              >
                <ExternalLink size={14} />
              </Link>
            )}
          </div>

          {channels.map((canal) => (
            <div key={canal.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={canal.avatarUrl} name={canal.handle || canal.label} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {canal.handle || canal.channelId}
                  <span className="ml-2 text-[11.5px] font-normal text-[var(--text-subtle)]">
                    {canal.label}
                  </span>
                </p>
                <p className="truncate text-[11.5px] text-[var(--text-subtle)]">
                  {formatCompact(canal.subscribers)} subs · {formatCompact(canal.totalViews)} vistas
                </p>
                {canal.tags.length > 0 ? (
                  <Etiquetas tags={canal.tags} />
                ) : (
                  puedeEditar && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditando({ id: canal.id, handle: canal.handle, label: canal.label, tags: [] })
                      }
                      className="mt-1.5 text-[11.5px] text-[var(--text-subtle)] underline-offset-2 transition hover:text-[var(--accent)] hover:underline"
                    >
                      Añadir etiquetas
                    </button>
                  )
                )}
              </div>
              <Link
                href={canal.channelUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[var(--text-subtle)] transition hover:text-[var(--accent)]"
                aria-label={`Abrir ${canal.handle}`}
              >
                <ExternalLink size={14} />
              </Link>
              {puedeEditar && (
                <>
                  <button
                    onClick={() =>
                      setEditando({ id: canal.id, handle: canal.handle, label: canal.label, tags: canal.tags })
                    }
                    aria-label={`Editar ${canal.handle}`}
                    title="Nombre y etiquetas"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => quitar(canal)}
                    disabled={borrando === canal.id}
                    aria-label={`Quitar ${canal.handle}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
                  >
                    {borrando === canal.id ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </>
              )}
            </div>
          ))}

          {channels.length === 0 && (
            <p className="px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
              Sin canales adicionales.
            </p>
          )}
        </div>
      </Card>

      <Modal
        open={abierto}
        onClose={() => {
          setAbierto(false);
          setError(null);
        }}
        size="md"
        title="Añadir canal"
        description="Pega el enlace del canal y traemos sus métricas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={añadir} disabled={guardando || !url.trim()}>
              {guardando && <LoaderCircle size={14} className="animate-spin" />}
              Añadir canal
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <Aviso>{error}</Aviso>}

          <div>
            <Label htmlFor="canal-url">Enlace del canal</Label>
            <div className="relative">
              <Link2
                size={14}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-subtle)]"
              />
              <Input
                id="canal-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && url.trim() && añadir()}
                placeholder="https://www.youtube.com/@canal"
                className="pl-9"
                autoFocus
              />
            </div>
            <FieldHint>Acepta /@handle, /channel/UC… o el ID del canal.</FieldHint>
          </div>

          <div>
            <Label htmlFor="canal-label">Cómo lo llamamos</Label>
            <Input
              id="canal-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Secundario"
              list="sugerencias-canal"
            />
            <datalist id="sugerencias-canal">
              {SUGERENCIAS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <CampoEtiquetas id="canal-tags" tags={tags} onChange={setTags} sugerencias={sugerencias} />
        </div>
      </Modal>

      {editando && (
        <Modal
          open
          onClose={() => {
            setEditando(null);
            setError(null);
          }}
          size="md"
          title={`Editar ${editando.handle || "canal"}`}
          description="Cómo lo llamamos y de qué va."
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={guardarEdicion}
                disabled={guardando || !editando.label.trim()}
              >
                {guardando && <LoaderCircle size={14} className="animate-spin" />}
                Guardar
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {error && <Aviso>{error}</Aviso>}
            <div>
              <Label htmlFor="canal-editar-label">Cómo lo llamamos</Label>
              <Input
                id="canal-editar-label"
                value={editando.label}
                onChange={(e) => setEditando({ ...editando, label: e.target.value })}
                placeholder="Canal Gameplays"
                list="sugerencias-canal-editar"
              />
              <datalist id="sugerencias-canal-editar">
                {SUGERENCIAS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <CampoEtiquetas
              id="canal-editar-tags"
              tags={editando.tags}
              onChange={(t) => setEditando({ ...editando, tags: t })}
              sugerencias={sugerencias}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

/** Las etiquetas de un canal, en fila bajo su nombre. */
function Etiquetas({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t} plain>
          {t}
        </Badge>
      ))}
    </span>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
      <TriangleAlert size={14} className="mt-px shrink-0" />
      {children}
    </p>
  );
}

/**
 * Etiquetas libres: se escriben y se confirman con Enter o coma. El catálogo
 * de categorías se ofrece como atajo, pero no obliga: «Minecraft» o «Clips en
 * inglés» no tienen por qué ser categorías de la agencia.
 */
function CampoEtiquetas({
  id,
  tags,
  onChange,
  sugerencias,
}: {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  sugerencias: string[];
}) {
  const [texto, setTexto] = useState("");
  const lleno = tags.length >= MAX_ETIQUETAS;

  function añadir(valor: string) {
    const limpio = valor.trim().replace(/,$/, "").trim();
    setTexto("");
    if (!limpio || lleno) return;
    if (tags.some((t) => t.toLowerCase() === limpio.toLowerCase())) return;
    onChange([...tags, limpio]);
  }

  const libres = sugerencias
    .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
    .slice(0, 8);

  return (
    <div>
      <Label htmlFor={id}>Etiquetas</Label>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex h-7 items-center gap-1 rounded-[var(--r-pill)] bg-[var(--accent-soft)] pr-1 pl-2.5 text-[12px] font-medium text-[var(--accent)]"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                aria-label={`Quitar ${t}`}
                className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-[var(--surface)]"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={texto}
        disabled={lleno}
        onChange={(e) => (e.target.value.endsWith(",") ? añadir(e.target.value) : setTexto(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            añadir(texto);
          }
        }}
        onBlur={() => añadir(texto)}
        placeholder={lleno ? "Máximo de etiquetas" : "Gameplays, Minecraft… y Enter"}
      />
      {libres.length > 0 && !lleno && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {libres.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => añadir(s)}
              className="h-7 rounded-[var(--r-pill)] border border-dashed border-[var(--line)] px-2.5 text-[12px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <FieldHint>De qué va este canal. Se ven al elegir canal para una campaña.</FieldHint>
    </div>
  );
}
