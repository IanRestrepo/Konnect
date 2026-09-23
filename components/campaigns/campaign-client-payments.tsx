"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, LoaderCircle, Plus, Trash2, TriangleAlert, Upload } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { CampaignPayment, Currency } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { ponerArchivo, subirABlob } from "@/lib/subir-cliente";
import { MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE } from "@/lib/archivos";

/**
 * Lo que el cliente ha pagado de la campaña.
 *
 * Es la mitad del dinero que no se apuntaba en ningún sitio: el pago a cada
 * creador vivía en sus piezas, pero «¿ya nos pagó la empresa?» solo se
 * contestaba mirando el banco. Van como cobros sueltos porque el cliente no
 * siempre paga de una vez —anticipo y resto son dos—, y lo que falta es lo
 * facturado menos la suma.
 */
export function CampaignClientPayments({
  campaignId,
  currency,
  facturado,
  cobros,
}: {
  campaignId: string;
  currency: Currency;
  /** Lo que se le cobra al cliente: la suma de las piezas vivas. */
  facturado: number;
  cobros: CampaignPayment[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_campanas");

  const cobrado = cobros.reduce((s, c) => s + c.amount, 0);
  const pendiente = Math.max(facturado - cobrado, 0);
  const pct = facturado > 0 ? Math.min(100, (cobrado / facturado) * 100) : 0;

  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  async function quitar(cobro: CampaignPayment) {
    if (!window.confirm(`¿Quitar el cobro de ${formatMoney(cobro.amount, currency)} del ${formatDate(cobro.paidAt)}?`)) {
      return;
    }
    setBorrando(cobro.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/campanas/${campaignId}/cobros?paymentId=${encodeURIComponent(cobro.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo quitar el cobro.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBorrando(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pago de la campaña</CardTitle>
        {puedeEditar && (
          <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
            <Plus size={14} />
            Registrar cobro
          </Button>
        )}
      </CardHeader>

      <div className="px-5 pb-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div className="h-full rounded-full bg-[var(--ok)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-[12px]">
          <span>
            <span className="block text-[var(--text-subtle)]">Facturado</span>
            <span className="tabular font-medium">{formatMoney(facturado, currency)}</span>
          </span>
          <span>
            <span className="block text-[var(--text-subtle)]">Cobrado</span>
            <span className="tabular font-medium text-[var(--ok)]">{formatMoney(cobrado, currency)}</span>
          </span>
          <span>
            <span className="block text-[var(--text-subtle)]">Por cobrar</span>
            <span className={`tabular font-medium ${pendiente > 0 ? "text-[var(--warn)]" : ""}`}>
              {formatMoney(pendiente, currency)}
            </span>
          </span>
        </div>
      </div>

      {error && (
        <p className="mx-5 mb-3 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          {error}
        </p>
      )}

      {cobros.length > 0 && (
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {cobros.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="tabular block text-[13px] font-medium">{formatMoney(c.amount, currency)}</span>
                <span className="block truncate text-[12px] text-[var(--text-muted)]">
                  {formatDate(c.paidAt)}
                  {c.notes ? ` · ${c.notes}` : ""}
                  {c.createdByName ? ` · ${c.createdByName}` : ""}
                </span>
              </span>
              {c.receiptUrl && (
                <a
                  href={c.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={c.receiptName ?? "Comprobante"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--ok)] transition hover:bg-[var(--surface-3)]"
                >
                  <FileCheck size={14} />
                </a>
              )}
              {puedeEditar && (
                <button
                  onClick={() => void quitar(c)}
                  disabled={borrando === c.id}
                  aria-label="Quitar cobro"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40"
                >
                  {borrando === c.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <CobroDialog
          campaignId={campaignId}
          currency={currency}
          sugerido={pendiente}
          onClose={() => setAbierto(false)}
        />
      )}
    </Card>
  );
}

function CobroDialog({
  campaignId,
  currency,
  sugerido,
  onClose,
}: {
  campaignId: string;
  currency: Currency;
  /** Lo que falta por cobrar: casi siempre es lo que llega. */
  sugerido: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [importe, setImporte] = useState(sugerido > 0 ? String(sugerido) : "");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  async function guardar() {
    if (!(Number(importe) > 0)) {
      setError("Escribe el importe que llegó.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("amount", String(Number(importe)));
      cuerpo.append("paidAt", new Date(`${fecha}T12:00:00`).toISOString());
      cuerpo.append("notes", nota.trim());
      if (archivo) {
        ponerArchivo(
          cuerpo,
          await subirABlob(archivo, {
            carpeta: `cobros/${campaignId}`,
            tipos: TIPOS_COMPROBANTE,
            maximo: MAXIMO_COMPROBANTE,
          }),
        );
      }
      const res = await fetch(`/api/campanas/${campaignId}/cobros`, { method: "POST", body: cuerpo });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo registrar el cobro.");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Registrar cobro"
      description="Lo que llegó del cliente por esta campaña."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cob-importe">Importe ({currency})</Label>
            <Input
              id="cob-importe"
              type="number"
              min={0}
              autoFocus
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              className="tabular"
            />
          </div>
          <div>
            <Label htmlFor="cob-fecha">Fecha</Label>
            <Input id="cob-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <FieldHint>
          {sugerido > 0
            ? `Faltan ${formatMoney(sugerido, currency)}. Si pagó una parte, cambia el importe.`
            : "La campaña ya está cobrada entera según lo pactado."}
        </FieldHint>
        <div>
          <Label htmlFor="cob-nota">Nota</Label>
          <Textarea
            id="cob-nota"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Anticipo del 50%, factura 0123…"
          />
        </div>
        <div>
          <Label>Comprobante</Label>
          <input
            ref={campo}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => campo.current?.click()}>
              <Upload size={13} />
              {archivo ? "Cambiar" : "Adjuntar"}
            </Button>
            <span className="min-w-0 truncate text-[12.5px] text-[var(--text-muted)]">
              {archivo ? archivo.name : "Opcional"}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
