"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { PORTAL_ROLE, SESSION_ITEM_KIND, SESSION_STATUS } from "@/lib/labels";
import type { CollabSession, PortalRole, SessionItemKind } from "@/lib/types";
import { formatCompact, formatDate } from "@/lib/utils";

type CreatorResumen = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
};

export function SessionDetail({
  session,
  campaignName,
  creator,
}: {
  session: CollabSession;
  campaignName: string | null;
  creator: CreatorResumen | null;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_sesiones");

  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const [itemOpen, setItemOpen] = useState(false);
  const [item, setItem] = useState({
    kind: "entregable" as SessionItemKind,
    title: "",
    url: "",
    notes: "",
  });

  const [accesoOpen, setAccesoOpen] = useState(false);
  const [acceso, setAcceso] = useState({
    role: "invitado" as PortalRole,
    label: "",
    canUpload: false,
  });

  const estado = SESSION_STATUS[session.status];
  const enlace =
    typeof window === "undefined" ? "" : `${window.location.origin}/portal/${session.id}`;

  async function copiar(texto: string, marca: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(marca);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      setError("El navegador no dejó copiar. Selecciónalo a mano.");
    }
  }

  async function llamar(url: string, init: RequestInit, fallo: string) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? fallo);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const json = (body: unknown, method = "POST"): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  async function guardarItem() {
    if (!item.title.trim()) {
      setError("Falta el título.");
      return;
    }
    const ok = await llamar(
      `/api/sesiones/${session.id}/items`,
      json({ ...item, title: item.title.trim(), url: item.url.trim() || null }),
      "No se pudo subir el material.",
    );
    if (ok) {
      setItem({ kind: "entregable", title: "", url: "", notes: "" });
      setItemOpen(false);
    }
  }

  async function guardarAcceso() {
    if (!acceso.label.trim()) {
      setError("Ponle un nombre al acceso.");
      return;
    }
    const ok = await llamar(
      `/api/sesiones/${session.id}/accesos`,
      json({ ...acceso, label: acceso.label.trim() }),
      "No se pudo crear el acceso.",
    );
    if (ok) {
      setAcceso({ role: "invitado", label: "", canUpload: false });
      setAccesoOpen(false);
    }
  }

  return (
    <div className="space-y-7">
      <Link
        href="/sesiones"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} />
        Sesiones
      </Link>

      <div>
        <PageTitle
          eyebrow={campaignName ?? "Sin campaña"}
          title={session.name}
          description={session.notes || "Sin notas."}
          actions={
            puedeEditar && (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() =>
                    llamar(
                      `/api/sesiones/${session.id}`,
                      json(
                        { status: session.status === "abierta" ? "cerrada" : "abierta" },
                        "PATCH",
                      ),
                      "No se pudo cambiar el estado.",
                    )
                  }
                  disabled={ocupado}
                >
                  {session.status === "abierta" ? "Cerrar sesión" : "Reabrir"}
                </Button>
                <Button variant="primary" size="lg" onClick={() => setItemOpen(true)}>
                  <Plus size={15} />
                  Subir material
                </Button>
              </>
            )
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={estado.tone}>{estado.label}</Badge>
          {creator && <Badge plain>{creator.name}</Badge>}
          {!session.showMetrics && <Badge tone="warn">Métricas ocultas</Badge>}
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {creator && session.showMetrics && (
        <StatBand>
          <Stat label="Suscriptores" value={formatCompact(creator.subscribers)} />
          <Stat label="Vistas del canal" value={formatCompact(creator.totalViews)} />
          <Stat label="Videos" value={formatCompact(creator.videoCount)} />
          <Stat label="Material compartido" value={String(session.items.length)} />
        </StatBand>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section>
          <SectionLabel>Material</SectionLabel>
          {session.items.length === 0 ? (
            <Card className="px-5 py-6 text-[13px] text-[var(--text-muted)]">
              Todavía no hay nada. Sube un enlace o espera a que lo haga el creador.
            </Card>
          ) : (
            <div className="space-y-2">
              {session.items.map((it) => {
                const kind = SESSION_ITEM_KIND[it.kind];
                return (
                  <Card key={it.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
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
                      </div>

                      {puedeEditar && (
                        <button
                          onClick={() =>
                            llamar(
                              `/api/sesiones/${session.id}/items?itemId=${it.id}`,
                              { method: "DELETE" },
                              "No se pudo borrar.",
                            )
                          }
                          aria-label="Borrar elemento"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enlace del portal</CardTitle>
            </CardHeader>
            <div className="border-t border-[var(--line)] p-4">
              <p className="text-[12.5px] text-[var(--text-muted)]">
                Manda este enlace junto con el código de cada persona.
              </p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={enlace} aria-label="Enlace del portal" />
                <Button variant="secondary" onClick={() => copiar(enlace, "enlace")}>
                  {copiado === "enlace" ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accesos</CardTitle>
              {puedeEditar && (
                <Button variant="secondary" size="sm" onClick={() => setAccesoOpen(true)}>
                  Añadir
                </Button>
              )}
            </CardHeader>

            <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {session.accesses.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge plain>{PORTAL_ROLE[a.role]}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {a.label}
                    </span>
                    {a.revoked && <Badge tone="danger">Revocado</Badge>}
                    {!a.canUpload && !a.revoked && <Badge>Solo lectura</Badge>}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <code className="tabular flex-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12.5px] tracking-wider">
                      {a.revoked ? "— — —" : a.code}
                    </code>
                    {!a.revoked && (
                      <Button variant="secondary" size="sm" onClick={() => copiar(a.code, a.id)}>
                        {copiado === a.id ? <Check size={13} /> : <Copy size={13} />}
                      </Button>
                    )}
                  </div>

                  <p className="mt-1.5 text-[11.5px] text-[var(--text-subtle)]">
                    {a.lastSeenAt ? `Última entrada ${formatDate(a.lastSeenAt)}` : "Nunca ha entrado"}
                  </p>

                  {puedeEditar && (
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ocupado}
                        onClick={() =>
                          llamar(
                            `/api/sesiones/${session.id}/accesos`,
                            json({ accessId: a.id, action: "regenerar" }, "PATCH"),
                            "No se pudo cambiar el código.",
                          )
                        }
                      >
                        <RefreshCw size={13} />
                        Nuevo código
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ocupado}
                        onClick={() =>
                          llamar(
                            `/api/sesiones/${session.id}/accesos`,
                            json(
                              { accessId: a.id, action: a.revoked ? "reactivar" : "revocar" },
                              "PATCH",
                            ),
                            "No se pudo cambiar el acceso.",
                          )
                        }
                      >
                        {a.revoked ? "Reactivar" : "Revocar"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {creator && (
            <Card>
              <CardHeader>
                <CardTitle>Creador</CardTitle>
              </CardHeader>
              <Link
                href={`/creadores/${creator.id}`}
                className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3 transition hover:bg-[var(--surface-2)]"
              >
                <Avatar src={creator.avatarUrl} name={creator.name} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{creator.name}</p>
                  <p className="truncate text-[12px] text-[var(--text-muted)]">
                    {creator.handle} · {formatCompact(creator.subscribers)} subs
                  </p>
                </div>
              </Link>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={itemOpen}
        onClose={() => setItemOpen(false)}
        title="Subir material"
        description="Por ahora se comparten enlaces: Drive, YouTube, Frame.io, lo que uses."
        footer={
          <>
            <Button variant="ghost" onClick={() => setItemOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarItem} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Subir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="it-kind">Tipo</Label>
            <Select
              id="it-kind"
              value={item.kind}
              onChange={(e) => setItem({ ...item, kind: e.target.value as SessionItemKind })}
            >
              <option value="entregable">Entregable</option>
              <option value="guion">Guion</option>
              <option value="borrador">Borrador</option>
              <option value="referencia">Referencia</option>
              <option value="nota">Nota</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="it-title">Título</Label>
            <Input
              id="it-title"
              value={item.title}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
              placeholder="Corte final del video"
            />
          </div>
          <div>
            <Label htmlFor="it-url">Enlace</Label>
            <Input
              id="it-url"
              value={item.url}
              onChange={(e) => setItem({ ...item, url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="it-notes">Notas</Label>
            <Textarea
              id="it-notes"
              rows={2}
              value={item.notes}
              onChange={(e) => setItem({ ...item, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={accesoOpen}
        onClose={() => setAccesoOpen(false)}
        title="Nuevo acceso"
        description="Se genera un código propio, que podrás copiar en la lista."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAccesoOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarAcceso} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Crear acceso
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="ac-role">Tipo</Label>
            <Select
              id="ac-role"
              value={acceso.role}
              onChange={(e) => setAcceso({ ...acceso, role: e.target.value as PortalRole })}
            >
              <option value="creador">Creador</option>
              <option value="cliente">Cliente</option>
              <option value="invitado">Invitado</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ac-label">Nombre</Label>
            <Input
              id="ac-label"
              value={acceso.label}
              onChange={(e) => setAcceso({ ...acceso, label: e.target.value })}
              placeholder="A quién se lo das"
            />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={acceso.canUpload}
              onChange={(e) => setAcceso({ ...acceso, canUpload: e.target.checked })}
            />
            Puede subir material
          </label>
        </div>
      </Modal>
    </div>
  );
}
