"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { CampaignStatus } from "@/lib/types";

/**
 * Enciende y apaga una campaña, como en los administradores de anuncios.
 * Encendida = activa, apagada = pausada. Los borradores se activan al encender;
 * las finalizadas no se tocan.
 *
 * Apagarla pide confirmación escribiendo su nombre, como borrarla. No destruye
 * nada, pero la saca de las activas —la lista con la que trabaja el equipo— y
 * un interruptor se toca sin querer al pasar el ratón. Encenderla no pregunta:
 * no hay nada que perder por encender.
 */
export function CampaignSwitch({
  campaignId,
  campaignName,
  status,
}: {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const can = useCan();
  const [optimista, setOptimista] = useState<CampaignStatus | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState("");

  const actual = optimista ?? status;
  const encendida = actual === "activa";
  // Cerradas: ni finalizada ni cancelada se encienden con el interruptor. Se
  // reabren desde «Editar campaña», que es donde se elige el estado a mano.
  const cerrada = actual === "finalizada" || actual === "cancelada";
  const puede = can("editar_campanas") && !cerrada;

  // Sin distinguir mayúsculas ni espacios de más: lo que se quiere comprobar
  // es que se leyó qué campaña es, no la ortografía exacta.
  const coincide = texto.trim().toLowerCase() === campaignName.trim().toLowerCase();

  async function aplicar(next: boolean) {
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

  function cambiar(next: boolean) {
    if (next) {
      void aplicar(true);
      return;
    }
    setTexto("");
    setConfirmando(true);
  }

  function cerrar() {
    setConfirmando(false);
    setTexto("");
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

      {/* Fuera del árbol, en el body: en el listado el interruptor vive dentro
          del enlace de la fila, y un clic en el diálogo abría la campaña. El
          portal saca el diálogo del enlace en el DOM, y cortar la propagación
          evita que el clic llegue igualmente al enlace por el árbol de React. */}
      {confirmando &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Modal
              open={confirmando}
              onClose={cerrar}
              size="sm"
              title="¿Apagar la campaña?"
              description="Pasa a pausada y sale de las campañas activas."
              footer={
                <>
                  <Button variant="ghost" onClick={cerrar}>
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    disabled={!coincide || guardando}
                    onClick={() => {
                      cerrar();
                      void aplicar(false);
                    }}
                  >
                    {guardando && <LoaderCircle size={14} className="animate-spin" />}
                    Apagar campaña
                  </Button>
                </>
              }
            >
              <div className="space-y-3">
                <ul className="space-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">
                  <li>
                    <span className="font-medium text-[var(--text)]">No se borra nada.</span> Creadores,
                    piezas, pagos y sesiones siguen como están.
                  </li>
                  <li>La encuentras en «Inactivas» y se vuelve a encender con el mismo interruptor.</li>
                </ul>

                <div>
                  <Label htmlFor="apagar-nombre">
                    Escribe <span className="font-semibold text-[var(--text)]">{campaignName}</span> para
                    confirmar
                  </Label>
                  <Input
                    id="apagar-nombre"
                    autoFocus
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && coincide) {
                        cerrar();
                        void aplicar(false);
                      }
                    }}
                    placeholder={campaignName}
                    autoComplete="off"
                  />
                  {texto && !coincide && <FieldHint>No coincide con el nombre de la campaña.</FieldHint>}
                </div>
              </div>
            </Modal>
          </div>,
          document.body,
        )}
    </span>
  );
}
