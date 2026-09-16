"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Film,
  LoaderCircle,
  Pencil,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { PageTitle, SectionLabel } from "@/components/ui/section";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Stat, StatBand } from "@/components/ui/stat";
import { ListBox, ListRow } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldHint, Input } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { EditDeliverableDialog } from "@/components/campaigns/edit-deliverable-dialog";
import type { Empleado } from "@/components/campaigns/campaign-team";
import { DELIVERABLE_STATUS, REQUIREMENT_STATUS } from "@/lib/labels";
import { piezaLabel } from "@/lib/socials";
import { creatorPayout } from "@/lib/pricing";
import type {
  Campaign,
  CollabSession,
  Creator,
  Deliverable,
  DeliverableKind,
} from "@/lib/types";
import { cn, formatCompact, formatDate, formatMoney } from "@/lib/utils";

/** Estado de pago, con el tono del badge. */
const PAGO = {
  pendiente: { label: "Sin pagar", tone: "neutral" as const },
  aprobado: { label: "Aprobado", tone: "accent" as const },
  pagado: { label: "Pagado", tone: "ok" as const },
};

/** `yyyy-mm-dd` para los campos de fecha; cadena vacía si no hay valor. */
function aInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Un creador visto desde dentro de la campaña.
 *
 * Reúne en una pantalla las tres preguntas que antes estaban repartidas o no
 * estaban: qué le encargamos y cómo va, para cuándo se espera cada cosa, y a
 * quién se le pregunta por él.
 */
export function CampaignCreatorView({
  campaign,
  creator,
  companyName,
  deliverables,
  session,
  empleados,
  kinds,
}: {
  campaign: Campaign;
  creator: Creator;
  companyName: string | null;
  /** Solo las piezas de este creador en esta campaña. */
  deliverables: Deliverable[];
  /** Su sesión de entrega, si la campaña se la abrió. */
  session: CollabSession | null;
  empleados: Empleado[];
  kinds: DeliverableKind[];
}) {
  const can = useCan();
  const puedeEditar = can("editar_campanas");

  const [editando, setEditando] = useState<Deliverable | null>(null);
  const [catalogo, setCatalogo] = useState(kinds);

  const vivas = deliverables.filter((d) => d.status !== "cancelado");
  const pactado = vivas.reduce((s, d) => s + creatorPayout(d, campaign), 0);
  const pagado = vivas
    .filter((d) => d.paymentStatus === "pagado")
    .reduce((s, d) => s + creatorPayout(d, campaign), 0);
  const vistas = deliverables
    .filter((d) => d.status === "publicado")
    .reduce((s, d) => s + (d.views ?? 0), 0);
  const pendientes = deliverables.filter((d) => d.status === "pendiente").length;

  const fin = campaign.endedContracts.find((e) => e.creatorId === creator.id) ?? null;

  return (
    <div className="space-y-7">
      <Link
        href={`/campanas/${campaign.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} />
        {campaign.name}
      </Link>

      <div>
        <PageTitle
          eyebrow={companyName ?? "Sin cliente"}
          title={creator.name}
          description={creator.handle}
          actions={
            <Link href={`/creadores/${creator.id}`}>
              <Button variant="secondary" size="lg">
                Ver su ficha
                <ExternalLink size={15} />
              </Button>
            </Link>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Avatar src={creator.avatarUrl} name={creator.name} size={28} />
          {fin ? (
            <Badge tone="neutral">
              Contrato finalizado el {formatDate(fin.endedAt)}
            </Badge>
          ) : (
            <Badge tone="ok">Contrato activo</Badge>
          )}
          {pendientes > 0 && (
            <Badge plain>
              {pendientes} pieza{pendientes === 1 ? "" : "s"} por entregar
            </Badge>
          )}
        </div>
      </div>

      <StatBand>
        <Stat
          label="Piezas"
          value={String(deliverables.length)}
          hint={`${deliverables.filter((d) => d.status === "publicado").length} publicadas`}
        />
        <Stat label="Vistas" value={formatCompact(vistas)} hint="de lo ya publicado" />
        <Stat
          label="Pactado"
          value={formatMoney(pactado, campaign.currency)}
          hint="lo que se lleva él"
        />
        <Stat
          label="Pagado"
          value={formatMoney(pagado, campaign.currency)}
          hint={`${formatMoney(pactado - pagado, campaign.currency)} por pagar`}
        />
      </StatBand>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section>
            <SectionLabel>Sus piezas en esta campaña</SectionLabel>
            <ListBox>
              {deliverables.map((d) => {
                const estado = DELIVERABLE_STATUS[d.status];
                return (
                  <ListRow
                    key={d.id}
                    chevron={false}
                    leading={
                      d.thumbnail ? (
                        <img
                          src={d.thumbnail}
                          alt=""
                          className="h-[38px] w-[66px] shrink-0 rounded-[var(--r-control)] object-cover"
                        />
                      ) : (
                        <span className="grid h-[38px] w-[66px] shrink-0 place-items-center rounded-[var(--r-control)] bg-[var(--surface-3)] text-[var(--text-subtle)]">
                          <Film size={16} strokeWidth={1.75} />
                        </span>
                      )
                    }
                    title={d.title ?? "Pendiente de publicar"}
                    subtitle={
                      <>
                        {piezaLabel(d.platform, d.type, d.customType)} ·{" "}
                        {d.publishedAt ? formatDate(d.publishedAt) : "sin fecha"} ·{" "}
                        {formatMoney(d.agreedFee, campaign.currency)}
                      </>
                    }
                    trailing={
                      <span className="flex items-center gap-2.5">
                        <span className="tabular hidden text-[13.5px] font-semibold sm:block">
                          {d.views ? formatCompact(d.views) : "—"}
                        </span>
                        <Badge tone={estado.tone}>{estado.label}</Badge>
                        <Badge tone={PAGO[d.paymentStatus].tone}>
                          {PAGO[d.paymentStatus].label}
                        </Badge>
                        {d.videoUrl && (
                          <Link
                            href={d.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Abrir la publicación"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                          >
                            <ExternalLink size={15} />
                          </Link>
                        )}
                        {puedeEditar && (
                          <button
                            onClick={() => setEditando(d)}
                            aria-label="Editar la pieza"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </span>
                    }
                  />
                );
              })}
            </ListBox>
          </section>

          <ChecklistDeSesion session={session} />
        </div>

        <div className="space-y-6">
          <EncargadosCard
            campaignId={campaign.id}
            creatorId={creator.id}
            creatorName={creator.name}
            leadIds={campaign.creatorLeads
              .filter((l) => l.creatorId === creator.id)
              .map((l) => l.userId)}
            managerId={campaign.managerId}
            empleados={empleados}
          />

          <Card>
            <CardHeader>
              <CardTitle>Su sesión de entrega</CardTitle>
            </CardHeader>
            {session ? (
              <div className="px-5 pb-5">
                <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                  Su enlace personal, lo que entrega y el material que se le comparte.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/sesiones/${session.id}`}>
                    <Button variant="secondary" size="sm">
                      Abrir su sesión
                      <ExternalLink size={14} />
                    </Button>
                  </Link>
                  <Link href={`/campanas/${campaign.id}/sesion`}>
                    <Button variant="ghost" size="sm">
                      Sesión maestra
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                Este creador no tiene sesión en esta campaña. Las campañas creadas antes de esta
                versión no las generaron automáticamente.
              </p>
            )}
          </Card>

          {fin && (
            <Card>
              <CardHeader>
                <CardTitle>Cierre del contrato</CardTitle>
              </CardHeader>
              <p className="px-5 pb-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                Finalizado el {formatDate(fin.endedAt)}
                {fin.reason ? `. ${fin.reason}` : "."}
              </p>
            </Card>
          )}
        </div>
      </div>

      <EditDeliverableDialog
        key={editando?.id ?? "sin-pieza"}
        open={editando !== null}
        onClose={() => setEditando(null)}
        campaignId={campaign.id}
        deliverable={editando}
        creator={creator}
        currency={campaign.currency}
        kinds={catalogo}
        onKindsChange={setCatalogo}
      />
    </div>
  );
}

/**
 * El checklist de su sesión, con las fechas editables desde aquí.
 *
 * La sesión ya existía, pero para mover una fecha había que salir de la
 * campaña, buscarla en Sesiones y volver. Las fechas son justo lo que se toca
 * a diario, así que viven donde se mira al creador.
 */
function ChecklistDeSesion({ session }: { session: CollabSession | null }) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_sesiones");

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cambiarFecha(requirementId: string, valor: string) {
    if (!session) return;
    setOcupado(requirementId);
    setError(null);
    try {
      const res = await fetch(`/api/sesiones/${session.id}/peticiones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId,
          accion: "editar",
          dueDate: valor ? new Date(`${valor}T00:00:00`).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la fecha.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(null);
    }
  }

  if (!session) return null;

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <SectionLabel className="mb-0">Lo que se le pidió</SectionLabel>
        <Link
          href={`/sesiones/${session.id}`}
          className="text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          Ver la sesión
        </Link>
      </div>

      {error && (
        <p className="mb-2.5 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {session.requirements.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Sin peticiones"
          description="Su checklist está vacío. Se arma desde la sesión de entrega."
        />
      ) : (
        <ListBox>
          {session.requirements.map((req) => {
            const estado = REQUIREMENT_STATUS[req.status];
            const valor = aInput(req.dueDate);
            // Tarde solo mientras siga abierta: una aprobada fuera de plazo ya
            // no es un problema que nadie tenga que resolver hoy.
            const tarde = valor && valor < hoy && req.status !== "aprobado";
            return (
              <ListRow
                key={req.id}
                chevron={false}
                title={req.title}
                subtitle={
                  req.url ? (
                    <Link
                      href={req.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[var(--accent)]"
                    >
                      {req.url}
                    </Link>
                  ) : (
                    (req.instructions || "Sin instrucciones")
                  )
                }
                trailing={
                  <span className="flex items-center gap-2.5">
                    {puedeEditar ? (
                      <span className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          value={valor}
                          disabled={ocupado === req.id}
                          onChange={(e) => void cambiarFecha(req.id, e.target.value)}
                          aria-label={`Fecha límite de ${req.title}`}
                          className={cn(
                            "tabular h-9 w-[150px] text-[12.5px]",
                            tarde && "text-[var(--danger)]",
                          )}
                        />
                        {ocupado === req.id && (
                          <LoaderCircle size={13} className="animate-spin text-[var(--text-subtle)]" />
                        )}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "tabular text-[12.5px]",
                          tarde ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
                        )}
                      >
                        {req.dueDate ? formatDate(req.dueDate) : "sin fecha"}
                      </span>
                    )}
                    <Badge tone={tarde ? "danger" : estado.tone}>
                      {tarde ? "Atrasado" : estado.label}
                    </Badge>
                  </span>
                }
              />
            );
          })}
        </ListBox>
      )}

      <FieldHint>La fecha la ve el creador en su portal. Vacía = sin plazo pactado.</FieldHint>
    </section>
  );
}

/**
 * Quién responde por este creador.
 *
 * Sin nadie marcado responde el manager de la campaña. Eso no se guarda: es la
 * lectura por defecto, y guardarlo obligaría a rehacerlo cada vez que cambia
 * el manager.
 */
function EncargadosCard({
  campaignId,
  creatorId,
  creatorName,
  leadIds,
  managerId,
  empleados,
}: {
  campaignId: string;
  creatorId: string;
  creatorName: string;
  leadIds: string[];
  managerId: string | null;
  empleados: Empleado[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeAsignar = can("asignar_campanas");

  const [editando, setEditando] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>(leadIds);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manager = empleados.find((e) => e.id === managerId) ?? null;
  const encargados = leadIds
    .map((id) => empleados.find((e) => e.id === id))
    .filter((e): e is Empleado => Boolean(e));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/creadores/${creatorId}/encargados`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: elegidos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quién lo lleva</CardTitle>
        {puedeAsignar &&
          (editando ? (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando && <LoaderCircle size={13} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setElegidos(leadIds);
                setError(null);
                setEditando(true);
              }}
            >
              {encargados.length ? "Editar" : "Asignar"}
            </Button>
          ))}
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {editando ? (
        <div className="space-y-2 border-t border-[var(--line)] p-4">
          <div className="flex flex-wrap gap-1.5">
            {empleados.map((e) => {
              const activo = elegidos.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    setElegidos((prev) =>
                      prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id],
                    )
                  }
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-[var(--r-pill)] border pr-3 pl-1 text-[12.5px] font-medium transition",
                    activo
                      ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                >
                  <Avatar src={e.avatarUrl} name={e.name} size={22} />
                  {e.name}
                </button>
              );
            })}
          </div>
          <FieldHint>
            Sin nadie marcado, responde quien lleva la campaña.
          </FieldHint>
        </div>
      ) : encargados.length === 0 ? (
        <div className="border-t border-[var(--line)]">
          {manager ? (
            <div className="flex items-center gap-3 px-4 py-2.5">
              <Avatar src={manager.avatarUrl} name={manager.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {manager.name}
              </span>
              <Badge plain>Por defecto</Badge>
            </div>
          ) : (
            <p className="px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
              Nadie responde por {creatorName}, y la campaña tampoco tiene responsable.
            </p>
          )}
          {manager && (
            <p className="px-4 pb-3 text-[12px] text-[var(--text-subtle)]">
              Nadie asignado en concreto: responde quien lleva la campaña.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {encargados.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar src={e.avatarUrl} name={e.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{e.name}</span>
              <Badge tone="accent">
                <UserRound size={12} />
                Encargado
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
