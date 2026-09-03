"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MoreHorizontal, Plus, RotateCcw, UserMinus, Users } from "lucide-react";
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
import { creatorPayout } from "@/lib/pricing";
import type { Campaign, Creator, Currency } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

/** Lo que hay que saber de un creador dentro de esta campaña. */
type Participante = {
  creator: Creator;
  piezas: number;
  /** Las que siguen esperándose. Son las que se cancelan al cerrar. */
  pendientes: number;
  /** Lo pactado con él, sin contar lo cancelado. */
  total: number;
  pagado: number;
  finalizado: { endedAt: string; reason: string } | null;
};

/**
 * Los creadores de la campaña, con lo suyo y el estado de su contrato.
 *
 * Existe porque la lista de entregables responde «qué piezas hay» pero no «con
 * quién estamos trabajando y cuánto le debemos», que es la pregunta con la que
 * se entra a una campaña a mitad de mes.
 */
export function CampaignCreators({
  campaign,
  creators,
  currency,
}: {
  campaign: Campaign;
  /** Todos los del catálogo: hacen falta para poder contratar a uno nuevo. */
  creators: Creator[];
  currency: Currency;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_campanas");

  const [contratando, setContratando] = useState(false);
  const [cerrando, setCerrando] = useState<Participante | null>(null);
  const [razon, setRazon] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finPorCreador = new Map(campaign.endedContracts.map((e) => [e.creatorId, e]));

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
        total: vivas.reduce((s, d) => s + creatorPayout(d, campaign), 0),
        pagado: vivas
          .filter((d) => d.paymentStatus === "pagado")
          .reduce((s, d) => s + creatorPayout(d, campaign), 0),
        finalizado: fin ? { endedAt: fin.endedAt, reason: fin.reason } : null,
      };
    })
    .filter((p): p is Participante => p !== null);

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
          {participantes.map((p) => (
            <ListRow
              key={p.creator.id}
              chevron={false}
              leading={<Avatar src={p.creator.avatarUrl} name={p.creator.name} size={34} />}
              title={p.creator.name}
              subtitle={
                p.finalizado
                  ? `Contrato finalizado el ${formatDate(p.finalizado.endedAt)}${
                      p.finalizado.reason ? ` · ${p.finalizado.reason}` : ""
                    }`
                  : `${p.piezas} pieza${p.piezas === 1 ? "" : "s"}${
                      p.pendientes ? ` · ${p.pendientes} por entregar` : ""
                    }`
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
                          aria-label={`Contrato de ${p.creator.name}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <div className="w-56 p-1">
                          <Link
                            href={`/creadores/${p.creator.id}`}
                            onClick={close}
                            className="flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-3)]"
                          >
                            <Users size={14} className="shrink-0" />
                            Ver su ficha
                          </Link>

                          <div className="my-1 h-px bg-[var(--line)]" />

                          {p.finalizado ? (
                            <button
                              onClick={() => {
                                close();
                                void contrato(p.creator.id, "reabrir");
                              }}
                              className="flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-3)]"
                            >
                              <RotateCcw size={14} className="shrink-0" />
                              Reabrir contrato
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                close();
                                setRazon("");
                                setError(null);
                                setCerrando(p);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] text-[var(--danger)] transition hover:bg-[var(--surface-3)]"
                            >
                              <UserMinus size={14} className="shrink-0" />
                              Finalizar contrato
                            </button>
                          )}
                        </div>
                      )}
                    </Popover>
                  )}
                </span>
              }
            />
          ))}
        </ListBox>
      )}

      <HireCreatorDialog
        open={contratando}
        onClose={() => setContratando(false)}
        campaignId={campaign.id}
        creators={creators}
        agencyFee={campaign.agencyFee ?? 20}
        currency={currency}
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
    </section>
  );
}
