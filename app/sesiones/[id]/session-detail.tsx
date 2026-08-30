"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  ListChecks,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
  KeyRound,
} from "lucide-react";
import { PageTitle, SectionHead } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { ListBox, ListRow, RowIcon } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { DefList, DefRow } from "@/components/ui/def-list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { MATERIAL_VACIO, MaterialFields, type MaterialDraft } from "@/components/sessions/material-fields";
import { useCan } from "@/components/session-provider";
import { PORTAL_ROLE, SESSION_ITEM_KIND, SESSION_STATUS } from "@/lib/labels";
import type { CollabSession, PortalRole, SessionItemKind } from "@/lib/types";
import { formatCompact, formatDate } from "@/lib/utils";

/** Estado de una petición, con el tono del badge que le corresponde. */
const ESTADO_PETICION = {
  pendiente: { label: "Pendiente", tone: "neutral" as const },
  enviado: { label: "En revisión", tone: "accent" as const },
  cambios: { label: "Cambios pedidos", tone: "warn" as const },
  aprobado: { label: "Aprobado", tone: "ok" as const },
};

const PETICION_VACIA = {
  kind: "entregable" as SessionItemKind,
  title: "",
  instructions: "",
  /** Un paso por línea; se parten al guardar. */
  steps: "",
};

type CreatorResumen = {
  id: string;
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

export function SessionDetail({
  session,
  portalUrl,
  campaignName,
  campanas,
  creadores,
  creator,
}: {
  session: CollabSession;
  /** Se arma en el servidor para que servidor y cliente pinten lo mismo. */
  portalUrl: string;
  campaignName: string | null;
  campanas: { id: string; name: string }[];
  creadores: { id: string; name: string }[];
  creator: CreatorResumen | null;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_sesiones");

  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const [itemOpen, setItemOpen] = useState(false);
  const [item, setItem] = useState<MaterialDraft>({ ...MATERIAL_VACIO });

  const [accesoOpen, setAccesoOpen] = useState(false);
  const [acceso, setAcceso] = useState({
    role: "invitado" as PortalRole,
    label: "",
    canUpload: false,
  });

  const [peticionOpen, setPeticionOpen] = useState(false);
  const [peticion, setPeticion] = useState({ ...PETICION_VACIA });

  const abierta = session.status === "abierta";
  const enlace = portalUrl;

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

  /** Aprueba o pide cambios sobre lo que el creador entregó. */
  async function revisar(requirementId: string, accion: "aprobar" | "cambios", reviewNotes = "") {
    await llamar(
      `/api/sesiones/${session.id}/peticiones`,
      json({ requirementId, accion, reviewNotes }, "PATCH"),
      "No se pudo revisar.",
    );
  }

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
      setItem({ ...MATERIAL_VACIO });
      setItemOpen(false);
    }
  }

  async function guardarPeticion() {
    if (!peticion.title.trim()) {
      setError("Ponle un título a la petición.");
      return;
    }
    const ok = await llamar(
      `/api/sesiones/${session.id}/peticiones`,
      json({
        kind: peticion.kind,
        title: peticion.title.trim(),
        instructions: peticion.instructions.trim(),
        // Una línea por paso; las vacías se descartan.
        steps: peticion.steps
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
      "No se pudo crear la petición.",
    );
    if (ok) {
      setPeticion({ ...PETICION_VACIA });
      setPeticionOpen(false);
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
              <Button variant="accent" size="lg" onClick={() => setItemOpen(true)}>
                <Plus size={16} />
                Subir material
              </Button>
            )
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Switch
            checked={abierta}
            busy={ocupado}
            disabled={!puedeEditar}
            label={abierta ? "Sesión abierta" : "Sesión cerrada"}
            onChange={(next) =>
              llamar(
                `/api/sesiones/${session.id}`,
                json({ status: next ? "abierta" : "cerrada" }, "PATCH"),
                "No se pudo cambiar el estado.",
              )
            }
          />
          <Badge tone={SESSION_STATUS[session.status].tone}>
            {SESSION_STATUS[session.status].label}
          </Badge>
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
          <Stat
            label="Material compartido"
            value={String(session.items.length)}
            hint={`${session.accesses.filter((a) => !a.revoked).length} accesos activos`}
          />
        </StatBand>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section>
          {/* Lo que la agencia le pide al creador. Es lo primero que él ve al
              entrar al portal, así que encabeza también aquí. */}
          <SectionHead
            title="Peticiones"
            hint={
              session.requirements.length
                ? `${session.requirements.filter((r) => r.status === "aprobado").length} de ${session.requirements.length} aprobadas`
                : "Guion, borrador, entregable final… lo que deba completar."
            }
            action={
              puedeEditar && session.requirements.length > 0 ? (
                <Button variant="secondary" size="sm" onClick={() => setPeticionOpen(true)}>
                  <Plus size={15} />
                  Añadir
                </Button>
              ) : undefined
            }
          />

          {session.requirements.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Sin peticiones"
              description="Define qué tiene que entregar el creador. Le aparecerá como una lista de casillas en su portal."
              action={
                puedeEditar && (
                  <Button variant="accent" onClick={() => setPeticionOpen(true)}>
                    <Plus size={16} />
                    Crear petición
                  </Button>
                )
              }
            />
          ) : (
            <ListBox>
              {session.requirements.map((req) => {
                const kind = SESSION_ITEM_KIND[req.kind];
                const estado = ESTADO_PETICION[req.status];
                return (
                  <ListRow
                    key={req.id}
                    chevron={false}
                    leading={
                      <RowIcon>
                        <ListChecks size={17} strokeWidth={1.75} />
                      </RowIcon>
                    }
                    title={req.title}
                    subtitle={
                      [
                        kind.label,
                        req.steps.length ? `${req.steps.length} pasos` : null,
                        req.submittedAt ? `entregado ${formatDate(req.submittedAt)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    trailing={
                      <span className="flex items-center gap-2">
                        {req.url && (
                          <a
                            href={req.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--text-subtle)] hover:text-[var(--accent)]"
                            aria-label="Abrir lo entregado"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <Badge tone={estado.tone}>{estado.label}</Badge>

                        {puedeEditar && req.status === "enviado" && (
                          <>
                            <button
                              onClick={() => revisar(req.id, "aprobar")}
                              aria-label={`Aprobar ${req.title}`}
                              title="Aprobar"
                              className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--ok-soft)] hover:text-[var(--ok)]"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => {
                                const nota = window.prompt("¿Qué hay que cambiar?");
                                if (nota) revisar(req.id, "cambios", nota);
                              }}
                              aria-label={`Pedir cambios en ${req.title}`}
                              title="Pedir cambios"
                              className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--warn-soft,var(--danger-soft))] hover:text-[var(--warn)]"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </>
                        )}

                        {puedeEditar && (
                          <button
                            onClick={() =>
                              llamar(
                                `/api/sesiones/${session.id}/peticiones?requirementId=${req.id}`,
                                { method: "DELETE" },
                                "No se pudo borrar.",
                              )
                            }
                            aria-label={`Borrar ${req.title}`}
                            className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    }
                  />
                );
              })}
            </ListBox>
          )}

          <SectionHead
            title="Material"
            hint={
              session.items.length
                ? `${session.items.length} elementos, del más reciente al más antiguo`
                : undefined
            }
          />

          {session.items.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Sin material todavía"
              description="Sube un enlace o espera a que lo haga el creador desde su portal."
              action={
                puedeEditar && (
                  <Button variant="accent" onClick={() => setItemOpen(true)}>
                    <Plus size={16} />
                    Subir material
                  </Button>
                )
              }
            />
          ) : (
            <ListBox>
              {session.items.map((it) => {
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
                        {it.url && (
                          <ExternalLink size={14} className="text-[var(--text-subtle)]" />
                        )}
                        {puedeEditar && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              llamar(
                                `/api/sesiones/${session.id}/items?itemId=${it.id}`,
                                { method: "DELETE" },
                                "No se pudo borrar.",
                              );
                            }}
                            aria-label={`Borrar ${it.title}`}
                            className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    }
                  />
                );
              })}
            </ListBox>
          )}

          <SectionHead
            title="Accesos"
            hint="Cada persona entra con su propio código."
            className="mt-7"
            action={
              puedeEditar && (
                <Button variant="secondary" size="sm" onClick={() => setAccesoOpen(true)}>
                  <Plus size={14} />
                  Añadir
                </Button>
              )
            }
          />

          <TableWrap>
            <Table className="min-w-[620px]">
              <thead>
                <tr>
                  <Th>Quién</Th>
                  <Th>Código</Th>
                  <Th>Última entrada</Th>
                  {puedeEditar && <Th align="right">Acciones</Th>}
                </tr>
              </thead>
              <tbody>
                {session.accesses.map((a) => (
                  <Tr key={a.id} className={a.revoked ? "opacity-55" : undefined}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Badge plain>{PORTAL_ROLE[a.role]}</Badge>
                        <span className="truncate font-medium">{a.label}</span>
                        {a.revoked ? (
                          <Badge tone="danger">Revocado</Badge>
                        ) : (
                          !a.canUpload && <Badge>Solo lectura</Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {a.revoked ? (
                        <span className="text-[var(--text-subtle)]">— — —</span>
                      ) : (
                        <button
                          onClick={() => copiar(a.code, a.id)}
                          title="Copiar código"
                          className="tabular inline-flex items-center gap-2 rounded-[var(--r-control)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12.5px] tracking-wider transition hover:bg-[var(--surface-3,var(--surface-2))] hover:text-[var(--accent)]"
                        >
                          {a.code}
                          {copiado === a.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      )}
                    </Td>
                    <Td className="text-[var(--text-muted)]">
                      {a.lastSeenAt ? formatDate(a.lastSeenAt) : "Nunca"}
                    </Td>
                    {puedeEditar && (
                      <Td align="right">
                        <span className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={ocupado}
                            title="Generar un código nuevo"
                            onClick={() =>
                              llamar(
                                `/api/sesiones/${session.id}/accesos`,
                                json({ accessId: a.id, action: "regenerar" }, "PATCH"),
                                "No se pudo cambiar el código.",
                              )
                            }
                          >
                            <RefreshCw size={13} />
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
                        </span>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enlace del portal</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => copiar(enlace, "enlace")}>
                {copiado === "enlace" ? <Check size={13} /> : <Copy size={13} />}
                Copiar
              </Button>
            </CardHeader>
            <div className="border-t border-[var(--line)] px-4 py-3">
              <p className="truncate text-[12.5px] text-[var(--text-muted)]">{enlace}</p>
              <p className="mt-1.5 text-[11.5px] text-[var(--text-subtle)]">
                Mándalo junto con el código de cada persona. Sin código no se ve nada.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <DefList className="border-t border-[var(--line)]">
              <DefRow label="Estado">{abierta ? "Abierta" : "Cerrada"}</DefRow>
              <DefRow label="Campaña">{campaignName ?? "—"}</DefRow>
              <DefRow label="Métricas en el portal">
                {session.showMetrics ? "Visibles" : "Ocultas"}
              </DefRow>
              <DefRow label="Creada">{formatDate(session.createdAt)}</DefRow>
            </DefList>
          </Card>

          {/* Recolocar la sesión. Una campaña borrada deja su sesión suelta
              con todo el material dentro: esto la devuelve a su sitio en vez
              de obligar a tirarla. */}
          {puedeEditar && (
            <Card>
              <CardHeader>
                <CardTitle>Asignación</CardTitle>
              </CardHeader>
              <div className="space-y-3 px-4 pb-4">
                <div>
                  <Label htmlFor="asig-campana">Campaña</Label>
                  <Picker
                    id="asig-campana"
                    value={session.campaignId ?? ""}
                    onChange={(v) =>
                      llamar(
                        `/api/sesiones/${session.id}`,
                        json({ campaignId: v || null }, "PATCH"),
                        "No se pudo cambiar la campaña.",
                      )
                    }
                    placeholder="Sin campaña"
                    options={[
                      { id: "", label: "Sin campaña" },
                      ...campanas.map((c) => ({ id: c.id, label: c.name })),
                    ]}
                  />
                </div>
                <div>
                  <Label htmlFor="asig-creador">Creador</Label>
                  <Picker
                    id="asig-creador"
                    value={session.creatorId ?? ""}
                    onChange={(v) =>
                      llamar(
                        `/api/sesiones/${session.id}`,
                        json({ creatorId: v || null }, "PATCH"),
                        "No se pudo cambiar el creador.",
                      )
                    }
                    placeholder="Sin creador"
                    options={[
                      { id: "", label: "Sin creador" },
                      ...creadores.map((c) => ({ id: c.id, label: c.name })),
                    ]}
                  />
                </div>
              </div>
            </Card>
          )}

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
        icon={Upload}
        title="Subir material"
        description="Se comparten enlaces, no archivos."
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
        <MaterialFields value={item} onChange={setItem} />
      </Modal>

      <Modal
        open={accesoOpen}
        onClose={() => setAccesoOpen(false)}
        icon={KeyRound}
        title="Nuevo acceso"
        description="Se genera un código propio, que podrás copiar en la tabla."
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
              {Object.entries(PORTAL_ROLE).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
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

      <Modal
        open={peticionOpen}
        onClose={() => setPeticionOpen(false)}
        icon={ListChecks}
        title="Nueva petición"
        description="Le aparecerá al creador como una casilla que debe completar."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPeticionOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarPeticion} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Crear petición
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="pt-kind">Tipo</Label>
            <Select
              id="pt-kind"
              value={peticion.kind}
              onChange={(e) =>
                setPeticion({ ...peticion, kind: e.target.value as SessionItemKind })
              }
            >
              <option value="guion">Guion</option>
              <option value="borrador">Borrador</option>
              <option value="entregable">Entregable final</option>
              <option value="referencia">Referencia</option>
              <option value="nota">Nota</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="pt-title">Título</Label>
            <Input
              id="pt-title"
              value={peticion.title}
              onChange={(e) => setPeticion({ ...peticion, title: e.target.value })}
              placeholder="Guion del video dedicado"
            />
          </div>

          <div>
            <Label htmlFor="pt-inst">Instrucciones</Label>
            <Textarea
              id="pt-inst"
              rows={2}
              value={peticion.instructions}
              onChange={(e) => setPeticion({ ...peticion, instructions: e.target.value })}
              placeholder="Qué esperas recibir y con qué criterio se aprueba."
            />
          </div>

          <div>
            <Label htmlFor="pt-steps">Pasos</Label>
            <Textarea
              id="pt-steps"
              rows={3}
              value={peticion.steps}
              onChange={(e) => setPeticion({ ...peticion, steps: e.target.value })}
              placeholder={"Añadir el enlace en la descripción\nMencionar la marca en los primeros 30s"}
            />
            <FieldHint>Uno por línea. Se le muestran como lista.</FieldHint>
          </div>
        </div>
      </Modal>
    </div>
  );
}
