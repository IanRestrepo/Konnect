"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";

/**
 * Borra la campaña entera: sus entregables y sus sesiones de entrega.
 *
 * Pide escribir el nombre porque no hay papelera. Las sesiones se van con ella
 * a propósito —si sobrevivieran, sus códigos de portal seguirían abriendo—, y
 * eso se avisa antes, no después.
 */
export function DeleteCampaignButton({
  campaignId,
  nombre,
  sesiones,
}: {
  campaignId: string;
  nombre: string;
  /** Cuántas sesiones se van con ella. */
  sesiones: number;
}) {
  const router = useRouter();
  const can = useCan();

  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("editar_campanas")) return null;

  const coincide = texto.trim() === nombre;

  function abrir() {
    setTexto("");
    setError(null);
    setOpen(true);
  }

  async function borrar() {
    if (!coincide) return;
    setBorrando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: texto.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo borrar la campaña.");
      // A la ficha ya no se puede volver: la lista es el único destino válido.
      router.replace("/campanas");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setBorrando(false);
    }
  }

  return (
    <>
      <Button variant="danger" size="icon-lg" onClick={abrir} aria-label="Borrar campaña">
        <Trash2 size={17} strokeWidth={1.75} />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Borrar la campaña"
        description="No hay vuelta atrás: no queda copia de esto en ningún sitio."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={borrar} disabled={!coincide || borrando}>
              {borrando && <LoaderCircle size={14} className="animate-spin" />}
              Borrar para siempre
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ul className="space-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">
            <li>Se borran sus entregables y lo pactado con cada creador.</li>
            {sesiones > 0 && (
              <li>
                Se borran {sesiones === 1 ? "su sesión de entrega" : `sus ${sesiones} sesiones`} y{" "}
                {sesiones === 1 ? "su código" : "sus códigos"} de portal dejan de abrir.
              </li>
            )}
            <li>Las fichas de los creadores y del cliente no se tocan.</li>
          </ul>

          <div>
            <Label htmlFor="borrar-nombre">
              Escribe <span className="font-semibold text-[var(--text)]">{nombre}</span> para
              confirmar
            </Label>
            <Input
              id="borrar-nombre"
              value={texto}
              autoFocus
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && coincide && borrar()}
              placeholder={nombre}
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
              <TriangleAlert size={14} className="mt-px shrink-0" />
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
