"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Vuelve a leer de YouTube las vistas de las piezas publicadas.
 *
 * Estaba en la lista de entregables; ahora va junto al gráfico de vistas, que
 * es lo que cambia al pulsarlo.
 */
export function RefreshMetricsButton({ campaignId, disabled }: { campaignId: string; disabled?: boolean }) {
  const router = useRouter();
  const [refrescando, setRefrescando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function refrescar() {
    setRefrescando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/metricas`, { method: "POST" });
      const texto = await res.text();
      let data: { actualizados?: number; fallidos?: number; sinVideo?: boolean; error?: string } = {};
      try {
        data = texto ? JSON.parse(texto) : {};
      } catch {
        // Cuerpo no-JSON: nos quedamos con el código de estado.
      }
      if (!res.ok) throw new Error(data.error ?? `No se pudo actualizar (error ${res.status}).`);
      setAviso(
        data.sinVideo
          ? "Ninguna pieza tiene video"
          : `${data.actualizados} actualizada${data.actualizados === 1 ? "" : "s"}${
              data.fallidos ? `, ${data.fallidos} sin responder` : ""
            }`,
      );
      router.refresh();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setRefrescando(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {aviso && <span className="text-[12px] text-[var(--text-muted)]">{aviso}</span>}
      <Button variant="secondary" size="sm" onClick={refrescar} disabled={disabled || refrescando}>
        {refrescando ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        Actualizar
      </Button>
    </span>
  );
}
