"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileCheck, LoaderCircle, RefreshCw, TriangleAlert, Upload, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { creatorPayout } from "@/lib/pricing";
import { piezaLabel } from "@/lib/socials";
import type { Campaign, Creator, Deliverable } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { ponerArchivo, subirABlob } from "@/lib/subir-cliente";
import { MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE } from "@/lib/archivos";

const PAGO: Record<Deliverable["paymentStatus"], { label: string; tone: "neutral" | "accent" | "ok" }> = {
  pendiente: { label: "Sin pagar", tone: "neutral" },
  aprobado: { label: "Aprobado", tone: "accent" },
  pagado: { label: "Pagado", tone: "ok" },
};

/**
 * El pago a un creador, de todas sus piezas en la campaña a la vez.
 *
 * Vivía en el menú de cada entregable, y eso no se parece a cómo se paga: al
 * creador se le hace una transferencia por lo que se le debe, no una por
 * video. Aquí se eligen las piezas que cubre ese pago, se sube su comprobante
 * una vez y se aprueban o se marcan pagadas juntas.
 *
 * El orden lo pone el comprobante: sin él no se puede aprobar ni pagar.
 */
export function CreatorPaymentDialog({
  open,
  onClose,
  campaign,
  creator,
}: {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  creator: Creator;
}) {
  const router = useRouter();
  const piezas = campaign.deliverables.filter(
    (d) => d.creatorId === creator.id && d.status !== "cancelado",
  );

  // De partida, lo que falta por pagar: es lo que se viene a pagar.
  const [elegidas, setElegidas] = useState<string[]>(() =>
    piezas.filter((d) => d.paymentStatus !== "pagado").map((d) => d.id),
  );
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const seleccion = piezas.filter((d) => elegidas.includes(d.id));
  const total = seleccion.reduce((s, d) => s + creatorPayout(d, campaign), 0);
  const sinComprobante = seleccion.filter((d) => !d.receiptUrl).length;
  const debe = piezas
    .filter((d) => d.paymentStatus !== "pagado")
    .reduce((s, d) => s + creatorPayout(d, campaign), 0);

  function alternar(id: string) {
    setElegidas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function subir(archivo: File) {
    setOcupado("comprobante");
    setError(null);
    try {
      const listo = await subirABlob(archivo, {
        carpeta: `comprobantes/${campaign.id}`,
        tipos: TIPOS_COMPROBANTE,
        maximo: MAXIMO_COMPROBANTE,
      });
      const cuerpo = new FormData();
      ponerArchivo(cuerpo, listo);
      cuerpo.append("deliverableIds", JSON.stringify(elegidas));
      const res = await fetch(`/api/campanas/${campaign.id}/creadores/${creator.id}/pago`, {
        method: "POST",
        body: cuerpo,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir el comprobante.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(null);
      if (campo.current) campo.current.value = "";
    }
  }

  async function cambiar(paymentStatus: Deliverable["paymentStatus"]) {
    setOcupado(paymentStatus);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaign.id}/creadores/${creator.id}/pago`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableIds: elegidas, paymentStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo cambiar el pago.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(null);
    }
  }

  const nada = seleccion.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={Wallet}
      title={`Pago a ${creator.name}`}
      description={`Se le debe ${formatMoney(debe, campaign.currency)} en esta campaña. Lo que marques aquí lo ve en su portal.`}
      footerNote={
        nada
          ? "Elige qué piezas cubre este pago"
          : `${seleccion.length} pieza${seleccion.length === 1 ? "" : "s"} · ${formatMoney(total, campaign.currency)}`
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {piezas.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No tiene piezas que pagar en esta campaña.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--r-card)] border border-[var(--line)]">
            {piezas.map((d) => {
              const marcada = elegidas.includes(d.id);
              return (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition hover:bg-[var(--surface-2)]">
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
                        marcada
                          ? "border-transparent bg-[var(--solid)] text-[var(--solid-fg)]"
                          : "border-[var(--line-strong)]",
                      )}
                    >
                      {marcada && <Check size={13} />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={marcada}
                      onChange={() => alternar(d.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">
                        {d.title ?? piezaLabel(d.platform, d.type, d.customType)}
                      </span>
                      <span className="block truncate text-[12px] text-[var(--text-muted)]">
                        {piezaLabel(d.platform, d.type, d.customType)}
                        {d.paidAt ? ` · pagada el ${formatDate(d.paidAt)}` : ""}
                      </span>
                    </span>
                    {d.receiptUrl ? (
                      <a
                        href={d.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={d.receiptName ?? "Ver comprobante"}
                        className="inline-flex items-center gap-1 text-[12px] text-[var(--ok)] hover:underline"
                      >
                        <FileCheck size={13} />
                        Comprobante
                      </a>
                    ) : (
                      <span className="text-[12px] text-[var(--text-subtle)]">Sin comprobante</span>
                    )}
                    <span className="tabular w-24 shrink-0 text-right text-[13px] font-medium">
                      {formatMoney(creatorPayout(d, campaign), campaign.currency)}
                    </span>
                    <Badge tone={PAGO[d.paymentStatus].tone}>{PAGO[d.paymentStatus].label}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {piezas.length > 0 && (
          <div className="space-y-2 rounded-[var(--r-control)] bg-[var(--surface-2)] p-3">
            <p className="text-[12.5px] text-[var(--text-muted)]">
              {nada
                ? "Marca las piezas que cubre el pago."
                : sinComprobante > 0
                  ? `Primero el comprobante: ${sinComprobante} de las elegidas todavía no lo tiene${sinComprobante === 1 ? "" : "n"}.`
                  : "Con comprobante: ya se puede aprobar o marcar pagado."}
            </p>
            <input
              ref={campo}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) void subir(archivo);
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={sinComprobante > 0 ? "primary" : "secondary"}
                size="sm"
                disabled={nada || ocupado !== null}
                onClick={() => campo.current?.click()}
              >
                {ocupado === "comprobante" ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                Subir comprobante
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={nada || sinComprobante > 0 || ocupado !== null}
                onClick={() => cambiar("aprobado")}
              >
                {ocupado === "aprobado" ? <LoaderCircle size={13} className="animate-spin" /> : <Wallet size={13} />}
                Aprobar pago
              </Button>
              <Button
                variant={sinComprobante === 0 && !nada ? "primary" : "secondary"}
                size="sm"
                disabled={nada || sinComprobante > 0 || ocupado !== null}
                onClick={() => cambiar("pagado")}
              >
                {ocupado === "pagado" ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                Marcar pagado
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={nada || ocupado !== null || seleccion.every((d) => d.paymentStatus === "pendiente")}
                onClick={() => cambiar("pendiente")}
              >
                {ocupado === "pendiente" ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Volver a sin pagar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
