"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileUp,
  ListChecks,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Stat, StatBand } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { Paginador, usePagina } from "@/components/ui/pager";
import { useCan } from "@/components/session-provider";
import {
  MATERIAL_VACIO,
  MaterialFields,
  type MaterialDraft,
} from "@/components/sessions/material-fields";
import { REQUIREMENT_STATUS, SESSION_ITEM_KIND } from "@/lib/labels";
import type {
  CampaignMaterial,
  CampaignRequirement,
  CollabSession,
  SessionItemKind,
  SessionRequirement,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { BackLink } from "@/components/ui/back-link";

export type SesionFila = {
  session: CollabSession;
  creator: { id: string; name: string; avatarUrl: string | null } | null;
  /** Enlace personal del creador, con su llave. Null si no tiene acceso activo. */
  enlace: string | null;
  tienePin: boolean;
};

/** Valor del destino cuando lo que se crea va a todas las sesiones. */
const TODAS = "__todas__";

/** `yyyy-mm-dd` para los campos de fecha; cadena vacía si no hay valor. */
function aInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** La fecha pasó y la petición sigue abierta. Aprobada tarde ya no es problema. */
function atrasada(req: Pick<SessionRequirement, "dueDate" | "status">, ahora: number): boolean {
  return Boolean(req.dueDate) && req.status !== "aprobado" && new Date(req.dueDate!).getTime() < ahora;
}

async function leer(res: Response, fallo: string) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? fallo);
  return data;
}

export function MasterSessionView({
  campaignId,
  campaignName,
  companyName,
  filas,
  comunes,
  materiales,
}: {
  campaignId: string;
  campaignName: string;
  companyName: string | null;
  filas: SesionFila[];
  comunes: CampaignRequirement[];
  materiales: CampaignMaterial[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_sesiones");

  // Se fija al montar: leer el reloj en cada render cambia el resultado sin
  // que cambie nada más.
  const [ahora] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /** Diálogo abierto: qué se crea y para quién. */
  const [peticion, setPeticion] = useState<{ destino: string; editando: CampaignRequirement | null } | null>(null);
  const [material, setMaterial] = useState<{ destino: string } | null>(null);

  const todasPeticiones = filas.flatMap((f) => f.session.requirements);
  const porRevisar = todasPeticiones.filter((r) => r.status === "enviado").length;
  const atrasadas = todasPeticiones.filter((r) => atrasada(r, ahora)).length;
  const abiertas = filas.filter((f) => f.session.status === "abierta").length;

  const pagina = usePagina(filas, campaignId, undefined, `maestra.${campaignId}`);

  const destinos = [
    { id: TODAS, label: "Todas las sesiones", hint: `${filas.length}` },
    ...filas.map((f) => ({
      id: f.session.id,
      label: `Solo ${f.creator?.name ?? f.session.name}`,
    })),
  ];

  async function llamar(url: string, init: RequestInit, fallo: string) {
    setOcupado(true);
    setError(null);
    try {
      await leer(await fetch(url, init), fallo);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-7">
      <BackLink fallbackHref={`/campanas/${campaignId}`} />

      <PageTitle
        eyebrow={companyName ? `Sesión maestra · ${companyName}` : "Sesión maestra"}
        title={campaignName}
        description="Todas las sesiones de la campaña en una pantalla. Lo que mandes a todas llega a cada creador; cada uno sigue viendo solo lo suyo."
        actions={
          puedeEditar && filas.length > 0 ? (
            <span className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={() => setMaterial({ destino: TODAS })}>
                <FileUp size={15} />
                Compartir material
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setPeticion({ destino: TODAS, editando: null })}
              >
                <Plus size={15} />
                Nueva petición
              </Button>
            </span>
          ) : undefined
        }
      />

      <StatBand className="xl:grid-cols-3">
        <Stat label="Sesiones abiertas" value={`${abiertas}`} hint={`de ${filas.length}`} />
        <Stat
          label="Por revisar"
          value={`${porRevisar}`}
          hint={porRevisar ? "entregas esperando respuesta" : "nada esperando"}
        />
        <Stat
          label="Atrasadas"
          value={`${atrasadas}`}
          hint={atrasadas ? "con la fecha ya pasada" : "todo en plazo"}
          tone={atrasadas ? "danger" : undefined}
        />
      </StatBand>

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section>
          <SectionLabel>Sesiones</SectionLabel>
          {filas.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin sesiones"
              description="Cada creador que contrates en la campaña tendrá aquí su sesión."
            />
          ) : (
            <div className="space-y-3">
              {pagina.visibles.map((fila) => (
                <TarjetaSesion
                  key={fila.session.id}
                  fila={fila}
                  campaignId={campaignId}
                  ahora={ahora}
                  puedeEditar={puedeEditar}
                  ocupado={ocupado}
                  onRevisar={(req, accion, nota) =>
                    llamar(
                      `/api/sesiones/${fila.session.id}/peticiones`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ requirementId: req.id, accion, reviewNotes: nota }),
                      },
                      "No se pudo revisar.",
                    )
                  }
                  onNuevaPeticion={() => setPeticion({ destino: fila.session.id, editando: null })}
                  onNuevoMaterial={() => setMaterial({ destino: fila.session.id })}
                />
              ))}
              <Paginador {...pagina} />
            </div>
          )}
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Para todas las sesiones</CardTitle>
              {puedeEditar && filas.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPeticion({ destino: TODAS, editando: null })}
                >
                  <Plus size={14} />
                  Petición
                </Button>
              )}
            </CardHeader>
            {comunes.length === 0 ? (
              <p className="border-t border-[var(--line)] px-5 py-4 text-[12.5px] text-[var(--text-muted)]">
                Nada común todavía. Lo que se pide aquí aparece en el checklist de cada creador,
                también de los que contrates después.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {comunes.map((c) => {
                  const copias = todasPeticiones.filter((r) => r.masterId === c.id);
                  const aprobadas = copias.filter((r) => r.status === "aprobado").length;
                  const tarde = copias.filter((r) => atrasada(r, ahora)).length;
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <ListChecks size={16} className="shrink-0 text-[var(--text-subtle)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{c.title}</span>
                        <span className="block truncate text-[12px] text-[var(--text-muted)]">
                          {SESSION_ITEM_KIND[c.kind].label}
                          {c.dueDate ? ` · para el ${formatDate(c.dueDate)}` : ""} · {aprobadas}/
                          {copias.length} aprobadas
                        </span>
                      </span>
                      {tarde > 0 && <Badge tone="danger">{tarde} atrasada{tarde === 1 ? "" : "s"}</Badge>}
                      {puedeEditar && (
                        <span className="flex shrink-0 gap-0.5">
                          <IconoBoton
                            etiqueta={`Editar ${c.title}`}
                            onClick={() => setPeticion({ destino: TODAS, editando: c })}
                          >
                            <Pencil size={14} />
                          </IconoBoton>
                          <IconoBoton
                            etiqueta={`Quitar ${c.title}`}
                            peligro
                            disabled={ocupado}
                            onClick={() => {
                              const entregadas = copias.filter((r) => r.status !== "pendiente").length;
                              const seguro = window.confirm(
                                entregadas > 0
                                  ? `«${c.title}» ya tiene ${entregadas} entrega${entregadas === 1 ? "" : "s"}. Si la quitas, se borran de todas las sesiones. ¿Seguir?`
                                  : `¿Quitar «${c.title}» de todas las sesiones?`,
                              );
                              if (!seguro) return;
                              void llamar(
                                `/api/campanas/${campaignId}/sesion/peticiones?masterId=${encodeURIComponent(c.id)}`,
                                { method: "DELETE" },
                                "No se pudo quitar la petición.",
                              );
                            }}
                          >
                            <Trash2 size={14} />
                          </IconoBoton>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Material común</CardTitle>
              {puedeEditar && filas.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setMaterial({ destino: TODAS })}>
                  <Plus size={14} />
                  Compartir
                </Button>
              )}
            </CardHeader>
            {materiales.length === 0 ? (
              <p className="border-t border-[var(--line)] px-5 py-4 text-[12.5px] text-[var(--text-muted)]">
                El brief, la guía de marca, el logo: lo que tienen que tener todos.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {materiales.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Paperclip size={15} className="shrink-0 text-[var(--text-subtle)]" />
                    <span className="min-w-0 flex-1">
                      {m.url ? (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[13px] font-medium hover:text-[var(--accent)]"
                        >
                          {m.title}
                        </a>
                      ) : (
                        <span className="block truncate text-[13px] font-medium">{m.title}</span>
                      )}
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">
                        {SESSION_ITEM_KIND[m.kind].label} · {m.authorLabel} · {formatDate(m.createdAt)}
                      </span>
                    </span>
                    {puedeEditar && (
                      <IconoBoton
                        etiqueta={`Quitar ${m.title}`}
                        peligro
                        disabled={ocupado}
                        onClick={() => {
                          if (!window.confirm(`¿Quitar «${m.title}» de todas las sesiones?`)) return;
                          void llamar(
                            `/api/campanas/${campaignId}/sesion/material?masterId=${encodeURIComponent(m.id)}`,
                            { method: "DELETE" },
                            "No se pudo quitar el material.",
                          );
                        }}
                      >
                        <Trash2 size={14} />
                      </IconoBoton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {peticion && (
        <PeticionDialog
          key={peticion.editando?.id ?? peticion.destino}
          campaignId={campaignId}
          destinos={destinos}
          inicial={peticion}
          onClose={() => setPeticion(null)}
        />
      )}

      {material && (
        <MaterialDialog
          key={material.destino}
          campaignId={campaignId}
          destinos={destinos}
          destinoInicial={material.destino}
          onClose={() => setMaterial(null)}
        />
      )}
    </div>
  );
}

/* ---------------- Una sesión ---------------- */

function TarjetaSesion({
  fila,
  campaignId,
  ahora,
  puedeEditar,
  ocupado,
  onRevisar,
  onNuevaPeticion,
  onNuevoMaterial,
}: {
  fila: SesionFila;
  campaignId: string;
  ahora: number;
  puedeEditar: boolean;
  ocupado: boolean;
  onRevisar: (req: SessionRequirement, accion: "aprobar" | "cambios", nota: string) => void;
  onNuevaPeticion: () => void;
  onNuevoMaterial: () => void;
}) {
  const { session, creator } = fila;
  const reqs = session.requirements;
  const aprobadas = reqs.filter((r) => r.status === "aprobado").length;
  const porRevisar = reqs.filter((r) => r.status === "enviado").length;
  const tarde = reqs.filter((r) => atrasada(r, ahora)).length;
  const proxima = reqs
    .filter((r) => r.status !== "aprobado" && r.dueDate)
    .map((r) => r.dueDate!)
    .sort()[0];

  // Abierta de entrada si hay algo que hacer con ella: una entrega esperando
  // revisión o una fecha pasada. Lo que va bien no necesita ocupar pantalla.
  const [abierta, setAbierta] = useState(porRevisar > 0 || tarde > 0);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!fila.enlace) return;
    try {
      await navigator.clipboard.writeText(fila.enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      window.prompt("Copia el enlace:", fila.enlace);
    }
  }

  const nombre = creator?.name ?? session.name;

  return (
    <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar src={creator?.avatarUrl ?? null} name={nombre} size={34} />
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={abierta}
        >
          <span className="block truncate text-[13.5px] font-medium">{nombre}</span>
          <span className="block truncate text-[12px] text-[var(--text-muted)]">
            {reqs.length === 0
              ? "Sin peticiones"
              : `${aprobadas}/${reqs.length} aprobadas${proxima ? ` · próxima el ${formatDate(proxima)}` : ""}`}
          </span>
        </button>

        <span className="hidden items-center gap-1.5 sm:flex">
          {session.status === "cerrada" && <Badge tone="neutral">Cerrada</Badge>}
          {porRevisar > 0 && <Badge tone="accent">{porRevisar} por revisar</Badge>}
          {tarde > 0 && <Badge tone="danger">{tarde} atrasada{tarde === 1 ? "" : "s"}</Badge>}
          {fila.enlace && !fila.tienePin && <Badge plain>Sin abrir</Badge>}
        </span>

        {fila.enlace && (
          <IconoBoton etiqueta={`Copiar el enlace de ${nombre}`} onClick={copiar}>
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </IconoBoton>
        )}
        <Link
          href={`/sesiones/${session.id}`}
          aria-label={`Abrir la sesión de ${nombre}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          <ExternalLink size={14} />
        </Link>
        <IconoBoton etiqueta={abierta ? "Plegar" : "Desplegar"} onClick={() => setAbierta((v) => !v)}>
          <ChevronDown size={15} className={cn("transition", abierta && "rotate-180")} />
        </IconoBoton>
      </div>

      {abierta && (
        <div className="border-t border-[var(--line)]">
          {reqs.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
              Nada pedido todavía a {nombre}.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {reqs.map((req) => {
                const estado = REQUIREMENT_STATUS[req.status];
                const esTarde = atrasada(req, ahora);
                return (
                  <li key={req.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px]">{req.title}</span>
                        {req.masterId && <Badge plain>Común</Badge>}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">
                        {req.dueDate ? `Para el ${formatDate(req.dueDate)}` : "Sin fecha"}
                        {req.url && (
                          <>
                            {" · "}
                            <a
                              href={req.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-[var(--accent)]"
                            >
                              ver entrega
                            </a>
                          </>
                        )}
                      </span>
                    </span>

                    <Badge tone={esTarde ? "danger" : estado.tone}>
                      {esTarde ? "Atrasado" : estado.label}
                    </Badge>

                    {puedeEditar && req.status === "enviado" && (
                      <span className="flex shrink-0 gap-0.5">
                        <IconoBoton
                          etiqueta={`Aprobar ${req.title}`}
                          disabled={ocupado}
                          onClick={() => onRevisar(req, "aprobar", "")}
                        >
                          <Check size={14} />
                        </IconoBoton>
                        <IconoBoton
                          etiqueta={`Pedir cambios en ${req.title}`}
                          disabled={ocupado}
                          onClick={() => {
                            const nota = window.prompt(`¿Qué tiene que cambiar ${nombre}?`);
                            if (nota) onRevisar(req, "cambios", nota);
                          }}
                        >
                          <RotateCcw size={13} />
                        </IconoBoton>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {session.items.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)] px-4 py-2.5">
              {session.items.map((item) => (
                <a
                  key={item.id}
                  href={item.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] transition hover:border-[var(--line-strong)]"
                >
                  <Paperclip size={12} className="shrink-0 text-[var(--text-subtle)]" />
                  <span className="truncate">{item.title}</span>
                </a>
              ))}
            </div>
          )}

          {puedeEditar && session.status === "abierta" && (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)] px-4 py-2.5">
              <Button variant="ghost" size="sm" onClick={onNuevaPeticion}>
                <Plus size={13} />
                Petición solo para {nombre.split(" ")[0]}
              </Button>
              <Button variant="ghost" size="sm" onClick={onNuevoMaterial}>
                <FileUp size={13} />
                Material solo para {nombre.split(" ")[0]}
              </Button>
              {creator && (
                <Link
                  href={`/campanas/${campaignId}/creador/${creator.id}`}
                  className="ml-auto inline-flex h-8 items-center px-2 text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Ver en la campaña
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Diálogo: petición ---------------- */

const TIPOS = Object.keys(SESSION_ITEM_KIND) as SessionItemKind[];

function PeticionDialog({
  campaignId,
  destinos,
  inicial,
  onClose,
}: {
  campaignId: string;
  destinos: { id: string; label: string; hint?: string }[];
  inicial: { destino: string; editando: CampaignRequirement | null };
  onClose: () => void;
}) {
  const router = useRouter();
  const editando = inicial.editando;

  const [destino, setDestino] = useState(inicial.destino);
  const [kind, setKind] = useState<SessionItemKind>(editando?.kind ?? "entregable");
  const [title, setTitle] = useState(editando?.title ?? "");
  const [instructions, setInstructions] = useState(editando?.instructions ?? "");
  const [steps, setSteps] = useState((editando?.steps ?? []).join("\n"));
  const [dueDate, setDueDate] = useState(aInput(editando?.dueDate ?? null));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!title.trim()) {
      setError("Ponle un título a la petición.");
      return;
    }
    const cuerpo = {
      kind,
      title: title.trim(),
      instructions: instructions.trim(),
      steps: steps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
    };

    setGuardando(true);
    setError(null);
    try {
      const res = editando
        ? await fetch(`/api/campanas/${campaignId}/sesion/peticiones`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ masterId: editando.id, ...cuerpo }),
          })
        : destino === TODAS
          ? await fetch(`/api/campanas/${campaignId}/sesion/peticiones`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cuerpo),
            })
          : await fetch(`/api/sesiones/${destino}/peticiones`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cuerpo),
            });
      await leer(res, "No se pudo guardar la petición.");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={ListChecks}
      title={editando ? "Editar petición común" : "Nueva petición"}
      description={
        editando
          ? "El cambio llega a todas las sesiones. Lo que ya entregó cada creador no se toca."
          : "Lo que se le pide al creador. Aparece en su checklist del portal."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            {editando ? "Guardar en todas" : destino === TODAS ? "Mandar a todas" : "Mandar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {!editando && (
          <div>
            <Label htmlFor="pm-destino">Para quién</Label>
            <Picker id="pm-destino" value={destino} onChange={setDestino} options={destinos} />
            <FieldHint>
              {destino === TODAS
                ? "Llega a cada creador de la campaña, también a los que contrates después."
                : "Solo la ve este creador."}
            </FieldHint>
          </div>
        )}

        <div>
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={kind === t}
                onClick={() => setKind(t)}
                className={cn(
                  "inline-flex h-8 items-center rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                  kind === t
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                {SESSION_ITEM_KIND[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div>
            <Label htmlFor="pm-title">Título</Label>
            <Input
              id="pm-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Guion del video dedicado"
            />
          </div>
          <div>
            <Label htmlFor="pm-due">Para cuándo</Label>
            <Input id="pm-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="pm-inst">Instrucciones</Label>
          <Textarea
            id="pm-inst"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Qué esperas recibir y con qué criterio se aprueba."
          />
        </div>

        <div>
          <Label htmlFor="pm-steps">Pasos</Label>
          <Textarea
            id="pm-steps"
            rows={3}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={"Añadir el enlace en la descripción\nMencionar la marca en los primeros 30s"}
          />
          <FieldHint>Uno por línea. Se le muestran como lista.</FieldHint>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Diálogo: material ---------------- */

function MaterialDialog({
  campaignId,
  destinos,
  destinoInicial,
  onClose,
}: {
  campaignId: string;
  destinos: { id: string; label: string; hint?: string }[];
  destinoInicial: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [destino, setDestino] = useState(destinoInicial);
  const [draft, setDraft] = useState<MaterialDraft>({ ...MATERIAL_VACIO, kind: "referencia" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  async function guardar() {
    if (!archivo && !draft.title.trim()) {
      setError("Ponle un título o sube un archivo.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      let res: Response;
      if (archivo) {
        const cuerpo = new FormData();
        cuerpo.append("archivo", archivo);
        cuerpo.append("kind", draft.kind);
        cuerpo.append("title", draft.title.trim());
        cuerpo.append("notes", draft.notes);
        res = await fetch(
          destino === TODAS
            ? `/api/campanas/${campaignId}/sesion/material`
            : `/api/sesiones/${destino}/archivos`,
          { method: "POST", body: cuerpo },
        );
      } else {
        res = await fetch(
          destino === TODAS
            ? `/api/campanas/${campaignId}/sesion/material`
            : `/api/sesiones/${destino}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: draft.kind,
              title: draft.title.trim(),
              url: draft.url.trim() || null,
              notes: draft.notes,
            }),
          },
        );
      }
      await leer(res, "No se pudo compartir el material.");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={FileUp}
      title="Compartir material"
      description="Lo ven los creadores en su portal. Pueden verlo y descargarlo, no subir el suyo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            {destino === TODAS ? "Compartir con todas" : "Compartir"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <div>
          <Label htmlFor="mm-destino">Para quién</Label>
          <Picker id="mm-destino" value={destino} onChange={setDestino} options={destinos} />
        </div>

        <MaterialFields value={draft} onChange={setDraft} />

        <div>
          <Label>O sube un archivo</Label>
          <input
            ref={campo}
            type="file"
            hidden
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => campo.current?.click()}>
              <FileUp size={14} />
              {archivo ? "Cambiar archivo" : "Elegir archivo"}
            </Button>
            {archivo && (
              <>
                <span className="min-w-0 truncate text-[12.5px] text-[var(--text-muted)]">
                  {archivo.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setArchivo(null);
                    if (campo.current) campo.current.value = "";
                  }}
                  className="text-[12px] text-[var(--text-subtle)] hover:text-[var(--danger)]"
                >
                  Quitar
                </button>
              </>
            )}
          </div>
          <FieldHint>Con archivo, el enlace de arriba no se usa. Hasta 100 MB.</FieldHint>
        </div>
      </div>
    </Modal>
  );
}

function IconoBoton({
  etiqueta,
  children,
  onClick,
  disabled,
  peligro,
}: {
  etiqueta: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition disabled:pointer-events-none disabled:opacity-40",
        peligro
          ? "hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          : "hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}
