"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  LogOut,
  Plus,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MATERIAL_VACIO, MaterialFields, type MaterialDraft } from "@/components/sessions/material-fields";
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

const ICONO_ITEM: Record<SessionItemKind, typeof FileText> = {
  entregable: Link2,
  guion: FileText,
  borrador: FileText,
  referencia: Link2,
  nota: FileText,
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
  const [form, setForm] = useState<MaterialDraft>({ ...MATERIAL_VACIO });

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
      setForm({ ...MATERIAL_VACIO });
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
    <div className="min-h-dvh bg-[var(--canvas)]">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Portal de entregas</p>
            <h1 className="truncate text-[16px] font-semibold tracking-tight">{name}</h1>
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
        {(notes || !canUpload || status === "cerrada") && (
          <Card className="px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={estado.tone}>{estado.label}</Badge>
              {!canUpload && <Badge>Solo lectura</Badge>}
            </div>
            {notes && (
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{notes}</p>
            )}
          </Card>
        )}

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
          <SectionHead
            title="Material"
            hint={items.length ? `${items.length} elementos` : undefined}
            action={
              canUpload && (
                <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
                  <Plus size={14} />
                  Subir
                </Button>
              )
            }
          />

          {items.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Todavía no hay nada"
              description={
                canUpload
                  ? "Sube el enlace de tu guion, tu borrador o el corte final."
                  : "Cuando se comparta material aparecerá aquí."
              }
              action={
                canUpload && (
                  <Button variant="accent" onClick={() => setOpen(true)}>
                    <Plus size={16} />
                    Subir material
                  </Button>
                )
              }
            />
          ) : (
            <ListBox>
              {items.map((it) => {
                const kind = SESSION_ITEM_KIND[it.kind];
                const Icono = ICONO_ITEM[it.kind];
                return (
                  <ListRow
                    key={it.id}
                    href={it.url ?? undefined}
                    chevron={false}
                    leading={
                      <RowIcon>
                        <Icono size={17} strokeWidth={1.75} />
                      </RowIcon>
                    }
                    title={it.title}
                    subtitle={[
                      it.authorLabel,
                      it.authorRole ? PORTAL_ROLE[it.authorRole] : "Agencia",
                      formatDate(it.createdAt),
                    ].join(" · ")}
                    trailing={
                      <span className="flex items-center gap-2">
                        <Badge tone={kind.tone}>{kind.label}</Badge>
                        {it.url && <ExternalLink size={14} className="text-[var(--text-subtle)]" />}
                      </span>
                    }
                  />
                );
              })}
            </ListBox>
          )}
        </section>
      </main>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={Upload}
        title="Subir material"
        description="Comparte el enlace de donde lo tengas subido."
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
        <MaterialFields value={form} onChange={setForm} />
      </Modal>
    </div>
  );
}
