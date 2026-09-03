"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/components/session-provider";
import type { CampaignStatus } from "@/lib/types";

/**
 * Enciende y apaga una campaña, como en los administradores de anuncios.
 * Encendida = activa, apagada = pausada. Los borradores se activan al encender;
 * las finalizadas no se tocan.
 */
export function CampaignSwitch({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const can = useCan();
  const [optimista, setOptimista] = useState<CampaignStatus | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual = optimista ?? status;
  const encendida = actual === "activa";
  // Cerradas: ni finalizada ni cancelada se encienden con el interruptor. Se
  // reabren desde «Editar campaña», que es donde se elige el estado a mano.
  const cerrada = actual === "finalizada" || actual === "cancelada";
  const puede = can("editar_campanas") && !cerrada;

  async function cambiar(next: boolean) {
    const destino: CampaignStatus = next ? "activa" : "pausada";
    setOptimista(destino);
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
      router.refresh();
    } catch (e) {
      // Falló: volvemos al estado que tenía.
      setOptimista(null);
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        checked={encendida}
        onChange={cambiar}
        disabled={!puede}
        busy={guardando}
        label={
          cerrada
            ? `Campaña ${actual}`
            : encendida
              ? "Pausar campaña"
              : "Activar campaña"
        }
      />
      {error && <span className="text-[11px] text-[var(--danger)]">{error}</span>}
    </span>
  );
}
