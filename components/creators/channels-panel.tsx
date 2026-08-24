"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Link2, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { CreatorChannel } from "@/lib/types";
import { formatCompact } from "@/lib/utils";

const SUGERENCIAS = ["Secundario", "Shorts", "Clips", "En vivo", "Vlogs", "Español"];

/** Canales adicionales del mismo creador, además del principal. */
export function ChannelsPanel({
  creatorId,
  principal,
  channels,
}: {
  creatorId: string;
  principal: { name: string; handle: string; avatarUrl: string | null; subscribers: number; channelUrl: string };
  channels: CreatorChannel[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState(SUGERENCIAS[0]);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function añadir() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/canales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo añadir el canal.");
      setUrl("");
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(canalId: string) {
    setBorrando(canalId);
    try {
      await fetch(`/api/creadores/${creatorId}/canales?canal=${canalId}`, { method: "DELETE" });
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
            </div>
            <Link
              href={principal.channelUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[var(--text-subtle)] transition hover:text-[var(--accent)]"
              aria-label="Abrir canal principal"
            >
              <ExternalLink size={14} />
            </Link>
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
                <button
                  onClick={() => quitar(canal.id)}
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
          {error && (
            <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
              <TriangleAlert size={14} className="mt-px shrink-0" />
              {error}
            </p>
          )}

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
        </div>
      </Modal>
    </>
  );
}
