"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  SquareArrowOutUpRight,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListBox, ListRow } from "@/components/ui/list";
import { Popover } from "@/components/ui/popover";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Label, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { HireCreatorDialog } from "@/components/campaigns/hire-creator-dialog";
import { Paginador, usePagina } from "@/components/ui/pager";
import type { Empleado } from "@/components/campaigns/campaign-team";
import { creatorPayout } from "@/lib/pricing";
import type { Campaign, Creator, Currency, DeliverableKind } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

/** Lo que hay que saber de un creador dentro de esta campaña. */
type Participante = {
  creator: Creator;
  piezas: number;
  /** Las que siguen esperándose. Son las que se cancelan al cerrar. */
  pendientes: number;
  /** Cuántas tienen el dinero ya fuera. Pesa al decidir si se borra o se cierra. */
  pagadas: number;
  /** Lo pactado con él, sin contar lo cancelado. */
  total: number;
  pagado: number;
  finalizado: { endedAt: string; reason: string } | null;
  /** Quién responde por él. Vacío = responde el manager de la campaña. */
  encargados: Empleado[];
};

/**
 * Los creadores de la campaña, con lo suyo y el estado de su contrato.
 *
 * Existe porque la lista de entregables responde «qué piezas hay» pero no «con
 * quién estamos trabajando y cuánto le debemos», que es la pregunta con la que
 * se entra a una campaña a mitad de mes. Cada fila lleva a su ficha dentro de
 * la campaña, que es donde se controlan sus piezas, sus fechas y quién lo
 * lleva.
 */
export function CampaignCreators({
  campaign,
  creators,
  currency,
  kinds,
  empleados,
}: {
  campaign: Campaign;
  /** Todos los del catálogo: hacen falta para poder contratar a uno nuevo. */
  creators: Creator[];
  currency: Currency;
  /** Tipos de pieza propios de la agencia. Se pueden crear al contratar. */
  kinds: DeliverableKind[];
  /** Cuentas activas, para decir quién lleva a cada creador. */
  empleados: Empleado[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_campanas");

  const [contratando, setContratando] = useState(false);
  const [cerrando, setCerrando] = useState<Participante | null>(null);
  const [quitando, setQuitando] = useState<Participante | null>(null);
  const [razon, setRazon] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El catálogo llega del servidor pero puede crecer sin recargar: el diálogo
  // de contratar deja crear un tipo de pieza en el sitio.
  const [catalogo, setCatalogo] = useState(kinds);

  const finPorCreador = new Map(campaign.endedContracts.map((e) => [e.creatorId, e]));
  const empleadoPorId = new Map(empleados.map((e) => [e.id, e]));

  // Participa quien tiene alguna pieza. El orden es el de entrada, que es como
  // el equipo los recuerda.
  const participantes: Participante[] = [
    ...new Set(campaign.deliverables.map((d) => d.creatorId)),
  ]
    .map((creatorId) => {
      const creator = creators.find((c) => c.id === creatorId);
      if (!creator) return null;

      const suyas = campaign.deliverables.filter((d) => d.creatorId === creatorId);
      const vivas = suyas.filter((d) => d.status !== "cancelado");
      const fin = finPorCreador.get(creatorId);

      return {
        creator,
        piezas: suyas.length,
        pendientes: suyas.filter((d) => d.status === "pendiente").length,
        pagadas: suyas.filter((d) => d.paymentStatus === "pagado").length,
        total: vivas.reduce((s, d) => s + creatorPayout(d, campaign), 0),
        pagado: vivas
          .filter((d) => d.paymentStatus === "pagado")
          .reduce((s, d) => s + creatorPayout(d, campaign), 0),
        finalizado: fin ? { endedAt: fin.endedAt, reason: fin.reason } : null,
        encargados: campaign.creatorLeads
          .filter((l) => l.creatorId === creatorId)
          .map((l) => empleadoPorId.get(l.userId))
          .filter((e): e is Empleado => Boolean(e)),
      };
    })
    .filter((p): p is Participante => p !== null);

  const pagina = usePagina(participantes, campaign.id);

  async function contrato(creatorId: string, accion: "finalizar" | "reabrir", reason = "") {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaign.id}/creadores`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, accion, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo cambiar el contrato.");
      setCerrando(null);
      setRazon("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(creatorId: string) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/campanas/${campaign.id}/creadores?creatorId=${encodeURIComponent(creatorId)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo quitar al creador.");
      setQuitando(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <SectionLabel className="mb-0">Creadores</SectionLabel>
        {puedeEditar && (
          <Button variant="accent" size="sm" onClick={() => setContratando(true)}>
            <Plus size={15} />
            Añadir creador
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-2.5 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          {error}
        </p>
      )}

      {participantes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin creadores"
          description="Contrata al primer creador de esta campaña y se le abrirá su sesión de entrega."
          action={
            puedeEditar && (
              <Button variant="accent" onClick={() => setContratando(true)}>
                <Plus size={16} />
                Añadir creador
              </Button>
            )
          }
        />
      ) : (
        <ListBox>
          {pagina.visibles.map((p) => {
            const ficha = `/campanas/${campaign.id}/creador/${p.creator.id}`;
            return (
              <ListRow
                key={p.creator.id}
                chevron={false}
                leading={<Avatar src={p.creator.avatarUrl} name={p.creator.name} size={34} />}
                // El nombre es el enlace y no la fila entera: la fila ya lleva
                // un menú, y un botón dentro de un enlace se porta mal.
                title={
                  <Link href={ficha} className="transition hover:text-[var(--accent)]">
                    {p.creator.name}
                  </Link>
                }
                subtitle={
                  p.finalizado
                    ? `Contrato finalizado el ${formatDate(p.finalizado.endedAt)}${
                        p.finalizado.reason ? ` · ${p.finalizado.reason}` : ""
                      }`
                    : [
                        `${p.piezas} pieza${p.piezas === 1 ? "" : "s"}`,
                        p.pendientes ? `${p.pendientes} por entregar` : null,
                        p.encargados.length
                          ? `lleva ${p.encargados.map((e) => e.name).join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                }
                trailing={
                  <span className="flex items-center gap-3">
                    <span className="hidden text-right sm:block">
                      <span className="tabular block text-[14px] font-semibold">
                        {formatMoney(p.total, currency)}
                      </span>
                      <span className="block text-[11.5px] text-[var(--text-subtle)]">
                        {formatMoney(p.pagado, currency)} pagado
                      </span>
                    </span>

                    {p.finalizado && <Badge tone="neutral">Finalizado</Badge>}

                    {puedeEditar && (
                      <Popover
                        side="bottom"
                        align="end"
                        portal
                        trigger={({ toggle }) => (
                          <button
                            onClick={toggle}
                            disabled={ocupado}
                            aria-label={`Acciones de ${p.creator.name}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <div className="w-60 p-1">
                            <Enlace href={ficha} onClick={close} icono={SquareArrowOutUpRight}>
                              Abrir en la campaña
                            </Enlace>
                            <Enlace
                              href={`/creadores/${p.creator.id}`}
                              onClick={close}
                              icono={Users}
                            >
                              Ver su ficha
                            </Enlace>

                            <div className="my-1 h-px bg-[var(--line)]" />

                            {p.finalizado ? (
                              <Opcion
                                icono={RotateCcw}
                                onClick={() => {
                                  close();
                                  void contrato(p.creator.id, "reabrir");
                                }}
                              >
                                Reabrir contrato
                              </Opcion>
                            ) : (
                              <Opcion
                                icono={UserMinus}
                                peligro
                                onClick={() => {
                                  close();
                                  setRazon("");
                                  setError(null);
                                  setCerrando(p);
                                }}
                              >
                                Finalizar contrato
                              </Opcion>
                            )}

                            {/* Para el creador que nunca debió estar aquí.
                                Finalizar guarda el rastro; esto lo borra. */}
                            <Opcion
                              icono={Trash2}
                              peligro
                              onClick={() => {
                                close();
                                setError(null);
                                setQuitando(p);
                              }}
                            >
                              Quitar de la campaña
                            </Opcion>
                          </div>
                        )}
                      </Popover>
                    )}
                  </span>
                }
              />
            );
          })}
        </ListBox>
      )}
      <Paginador {...pagina} className="mt-2.5" />

      <HireCreatorDialog
        open={contratando}
        onClose={() => setContratando(false)}
        campaignId={campaign.id}
        creators={creators}
        currency={currency}
        kinds={catalogo}
        onKindsChange={setCatalogo}
      />

      <Modal
        open={cerrando !== null}
        onClose={() => setCerrando(null)}
        size="sm"
        title="Finalizar el contrato"
        description={
          cerrando
            ? `Se cierra el trabajo con ${cerrando.creator.name} en esta campaña.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCerrando(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={ocupado}
              onClick={() => cerrando && contrato(cerrando.creator.id, "finalizar", razon.trim())}
            >
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Finalizar contrato
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ul className="space-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">
            <li>
              <span className="font-medium text-[var(--text)]">No se borra nada.</span> Lo que ya
              entregó y lo que ya se le pagó se queda con su dinero.
            </li>
            {cerrando && cerrando.pendientes > 0 ? (
              <li>
                Se cancelan sus {cerrando.pendientes} pieza
                {cerrando.pendientes === 1 ? "" : "s"} pendiente
                {cerrando.pendientes === 1 ? "" : "s"}: dejan de contar en los totales.
              </li>
            ) : (
              <li>No tiene piezas pendientes, así que los totales no cambian.</li>
            )}
            <li>Se puede reabrir después.</li>
          </ul>

          <div>
            <Label htmlFor="fin-razon">Motivo</Label>
            <Textarea
              id="fin-razon"
              rows={2}
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              placeholder="No entregó a tiempo, se reemplazó por otro creador…"
            />
            <FieldHint>Opcional. Queda en la ficha y en la bitácora.</FieldHint>
          </div>
        </div>
      </Modal>

      <Modal
        open={quitando !== null}
        onClose={() => setQuitando(null)}
        size="sm"
        title="Quitar de la campaña"
        description={
          quitando
            ? `${quitando.creator.name} desaparece de esta campaña con todo lo suyo.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuitando(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={ocupado}
              onClick={() => quitando && quitar(quitando.creator.id)}
            >
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Quitar de la campaña
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ul className="space-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">
            <li>
              Se borran sus {quitando?.piezas ?? 0} pieza
              {quitando?.piezas === 1 ? "" : "s"} de esta campaña, publicadas o no.
            </li>
            <li>Se borra su sesión de entrega y su código de portal deja de servir.</li>
            <li>
              <span className="font-medium text-[var(--text)]">No hay papelera.</span> Su ficha de
              creador y sus otras campañas no se tocan.
            </li>
          </ul>

          {quitando && quitando.pagadas > 0 && (
            <p className="rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2.5 text-[12.5px] text-[var(--danger)]">
              Cuidado: {quitando.pagadas} de sus piezas ya están marcadas como pagadas. Ese dinero
              salió de verdad y va a desaparecer de los informes. Para el trabajo que sí ocurrió,
              lo que quieres es «Finalizar contrato».
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}

function Enlace({
  href,
  icono: Icono,
  children,
  onClick,
}: {
  href: string;
  icono: typeof Users;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-3)]"
    >
      <Icono size={14} className="shrink-0" />
      {children}
    </Link>
  );
}

function Opcion({
  icono: Icono,
  children,
  onClick,
  peligro,
}: {
  icono: typeof Users;
  children: React.ReactNode;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-3)] ${
        peligro ? "text-[var(--danger)]" : ""
      }`}
    >
      <Icono size={14} className="shrink-0" />
      {children}
    </button>
  );
}
