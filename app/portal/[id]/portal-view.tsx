"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, LogOut, Plus, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { PORTAL_ROLE, SESSION_ITEM_KIND, SESSION_STATUS } from "@/lib/labels";
import type { PortalRole, SessionItem, SessionItemKind, SessionStatus } from "@/lib/types";
import { formatCompact, formatDate } from "@/lib/utils";

type CreatorResumen = {
  name: string;
  handle: string;
  avatarUrl: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
};

/** Lo que ve quien entró con un código. Sin navegación ni datos de la agencia. */
export function PortalView({
  sessionId,
  name,
  notes,
  status,
  role,
  label,
  canUpload,
  items,
  creator,
}: {
  sessionId: string;
  name: string;
  notes: string;
  status: SessionStatus;
  role: PortalRole;
  label: string;
  canUpload: boolean;
  items: SessionItem[];
  creator: CreatorResumen | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "entregable" as SessionItemKind,
    title: "",
    url: "",
    notes: "",
  });

  const estado = SESSION_STATUS[status];

  async function subir() {
    if (!form.title.trim()) {
      setError("Falta el título.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${sessionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, title: form.title.trim(), url: form.url.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir.");
      setForm({ kind: "entregable", title: "", url: "", notes: "" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  }

  async function salir() {
    await fetch(`/api/portal/${sessionId}/salir`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="border-b border-[var(--line)] px-5 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Portal de entregas</p>
            <h1 className="truncate text-[18px] font-semibold tracking-tight">{name}</h1>
          </div>
          <Badge plain>
            {PORTAL_ROLE[role]} · {label}
          </Badge>
          <Button variant="ghost" size="sm" onClick={salir}>
            <LogOut size={14} />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={estado.tone}>{estado.label}</Badge>
          {!canUpload && <Badge>Solo lectura</Badge>}
        </div>

        {notes && <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{notes}</p>}

        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {creator && (
          <Card>
            <CardHeader>
              <CardTitle>Creador</CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3">
              <Avatar src={creator.avatarUrl} name={creator.name} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{creator.name}</p>
                <p className="truncate text-[12px] text-[var(--text-muted)]">{creator.handle}</p>
              </div>
            </div>
            <StatBand>
              <Stat label="Suscriptores" value={formatCompact(creator.subscribers)} />
              <Stat label="Vistas del canal" value={formatCompact(creator.totalViews)} />
              <Stat label="Videos" value={formatCompact(creator.videoCount)} />
            </StatBand>
          </Card>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold tracking-tight">Material</h2>
            {canUpload && (
              <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                <Plus size={14} />
                Subir
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <Card className="px-5 py-6 text-[13px] text-[var(--text-muted)]">
              Todavía no hay nada compartido.
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((it) => {
                const kind = SESSION_ITEM_KIND[it.kind];
                return (
                  <Card key={it.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                      <span className="text-[13px] font-medium">{it.title}</span>
                    </div>
                    {it.url && (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-[var(--accent)] hover:underline"
                      >
                        <ExternalLink size={12} className="shrink-0" />
                        {it.url}
                      </a>
                    )}
                    {it.notes && (
                      <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{it.notes}</p>
                    )}
                    <p className="mt-1 text-[11.5px] text-[var(--text-subtle)]">
                      {it.authorLabel}
                      {it.authorRole ? ` · ${PORTAL_ROLE[it.authorRole]}` : " · Agencia"} ·{" "}
                      {formatDate(it.createdAt)}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Subir material"
        description="Comparte el enlace de Drive, YouTube, WeTransfer o donde lo tengas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={subir} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Subir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="pt-kind">Tipo</Label>
            <Select
              id="pt-kind"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as SessionItemKind })}
            >
              <option value="entregable">Entregable</option>
              <option value="guion">Guion</option>
              <option value="borrador">Borrador</option>
              <option value="referencia">Referencia</option>
              <option value="nota">Nota</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="pt-title">Título</Label>
            <Input
              id="pt-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Primer corte"
            />
          </div>
          <div>
            <Label htmlFor="pt-url">Enlace</Label>
            <Input
              id="pt-url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="pt-notes">Notas</Label>
            <Textarea
              id="pt-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
