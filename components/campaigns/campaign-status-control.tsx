"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useCan } from "@/components/session-provider";
import { CAMPAIGN_STATUS, CAMPAIGN_STATUS_CIERRE } from "@/lib/labels";
import type { CampaignStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDEN: CampaignStatus[] = ["borrador", "activa", "pausada", "finalizada", "cancelada"];

/** Qué significa cada estado, para que elegir no sea adivinar. */
const EXPLICACION: Record<CampaignStatus, string> = {
  borrador: "Se está armando. No cuenta como trabajo en marcha.",
  activa: "En marcha: los creadores están produciendo.",
  pausada: "Detenida temporalmente. Se puede reanudar.",
  finalizada: "Se cumplió y se cierra.",
  cancelada: "Se cayó. Se cierra sin haberse cumplido.",
};

/**
 * Estado de la campaña, elegido a mano.
 *
 * Antes era un interruptor de encendido y apagado: solo llegaba a activa y
 * pausada, «finalizada» era un callejón sin salida al que no se podía entrar
 * desde la pantalla, y cancelar no existía. Se cambió por una lista porque
 * cerrar una campaña es una decisión, no un interruptor: los dos estados de
 * cierre piden confirmación.
 */
export function CampaignStatusControl({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const can = useCan();
  const puede = can("editar_campanas");

  const [confirmar, setConfirmar] = useState<CampaignStatus | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual = CAMPAIGN_STATUS[status];

  async function aplicar(destino: CampaignStatus) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: destino }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo cambiar el estado.");
      }
      setConfirmar(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  function elegir(destino: CampaignStatus, cerrar: () => void) {
    cerrar();
    if (destino === status) return;
    // Cerrar una campaña se confirma; volver a activarla o pausarla, no.
    if (CAMPAIGN_STATUS_CIERRE.includes(destino)) {
      setError(null);
      setConfirmar(destino);
      return;
    }
    void aplicar(destino);
  }

  if (!puede) return <Badge tone={actual.tone}>{actual.label}</Badge>;

  return (
    <>
      <Popover
        align="start"
        // La cabecera de la campaña recorta: sin portal el panel se corta.
        portal
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-7 items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[12px] font-medium transition hover:border-[var(--line-strong)]"
            aria-label="Cambiar el estado de la campaña"
          >
            <Badge tone={actual.tone}>{actual.label}</Badge>
            {guardando ? (
              <LoaderCircle size={12} className="animate-spin text-[var(--text-subtle)]" />
            ) : (
              <ChevronDown size={13} className="text-[var(--text-subtle)]" />
            )}
          </button>
        )}
      >
        {({ close }) => (
          <div className="w-64 p-1">
            {ORDEN.map((id) => {
              const st = CAMPAIGN_STATUS[id];
              const activo = id === status;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => elegir(id, close)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-[var(--r-chip)] px-2.5 py-2 text-left transition",
                    activo ? "bg-[var(--surface-3)]" : "hover:bg-[var(--surface-2)]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="mt-1 block text-[11.5px] text-[var(--text-subtle)]">
                      {EXPLICACION[id]}
                    </span>
                  </span>
                  {activo && <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />}
                </button>
              );
            })}
          </div>
        )}
      </Popover>

      {error && !confirmar && (
        <span className="ml-2 text-[11px] text-[var(--danger)]">{error}</span>
      )}

      <Modal
        open={confirmar !== null}
        onClose={() => setConfirmar(null)}
        size="sm"
        title={confirmar === "cancelada" ? "Cancelar la campaña" : "Finalizar la campaña"}
        description={
          confirmar === "cancelada"
            ? "Se cierra sin haberse cumplido. Los entregables y su dinero se conservan tal cual."
            : "Se cierra como cumplida. Los entregables y su dinero se conservan tal cual."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmar(null)}>
              Volver
            </Button>
            <Button
              variant={confirmar === "cancelada" ? "danger" : "primary"}
              onClick={() => confirmar && aplicar(confirmar)}
              disabled={guardando}
            >
              {guardando && <LoaderCircle size={14} className="animate-spin" />}
              {confirmar === "cancelada" ? "Cancelar campaña" : "Finalizar campaña"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[var(--text-muted)]">
          Se puede reabrir después volviendo a ponerla activa.
        </p>
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
