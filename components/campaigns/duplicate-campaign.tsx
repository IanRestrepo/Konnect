"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LoaderCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";

/**
 * Duplica una campaña para volver a correrla con el mismo equipo.
 *
 * Copia el acuerdo —creadores, redes y precios— pero no el resultado: las
 * piezas nacen pendientes y sin métricas, porque son publicaciones nuevas.
 */
export function DuplicateCampaignButton({
  campaignId,
  nombre,
}: {
  campaignId: string;
  nombre: string;
}) {
  const router = useRouter();
  const can = useCan();
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(`${nombre} (copia)`);
  const [conSesiones, setConSesiones] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("editar_campanas")) return null;

  async function duplicar() {
    if (!nuevo.trim()) {
      setError("Ponle nombre a la copia.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/duplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nuevo.trim(), conSesiones }),
      });
      const texto = await res.text();
      let data: { id?: string; error?: string } = {};
      try {
        data = texto ? JSON.parse(texto) : {};
      } catch {
        // Cuerpo no-JSON: nos quedamos con el código de estado.
      }
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? `No se pudo duplicar (error ${res.status}).`);
      }
      router.push(`/campanas/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setOcupado(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => setAbierto(true)}>
        <Copy size={15} />
        Duplicar
      </Button>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        icon={Copy}
        title="Duplicar campaña"
        description="Se copian los creadores, sus redes y lo pactado con cada uno."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={duplicar} disabled={ocupado}>
              {ocupado && <LoaderCircle size={14} className="animate-spin" />}
              Duplicar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="copia-nombre">Nombre de la copia</Label>
            <Input
              id="copia-nombre"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && duplicar()}
              autoFocus
            />
            <FieldHint>
              Nace como borrador, con las piezas pendientes y sin métricas.
            </FieldHint>
          </div>

          <label className="flex items-start gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={conSesiones}
              onChange={(e) => setConSesiones(e.target.checked)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              Crear sesiones de entrega
              <span className="block text-[12px] text-[var(--text-subtle)]">
                Con códigos nuevos: los de la campaña original siguen sirviendo para aquella.
              </span>
            </span>
          </label>

          {error && (
            <p className="rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
