"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  Film,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { SectionLabel } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListBox, ListRow } from "@/components/ui/list";
import { AddDeliverableDialog } from "@/components/campaigns/add-deliverable-dialog";
import { DELIVERABLE_STATUS, DELIVERABLE_TYPE } from "@/lib/labels";
import type { Creator, Currency, Deliverable } from "@/lib/types";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";

/** Estado de pago, con el tono del badge. */
const PAGO: Record<Deliverable["paymentStatus"], { label: string; tone: "neutral" | "accent" | "ok" }> = {
  pendiente: { label: "Sin pagar", tone: "neutral" },
  aprobado: { label: "Aprobado", tone: "accent" },
  pagado: { label: "Pagado", tone: "ok" },
};

export function DeliverablesSection({
  campaignId,
  deliverables,
  creators,
  currency,
}: {
  campaignId: string;
  deliverables: Deliverable[];
  creators: Creator[];
  currency: Currency;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function llamar(id: string, init: RequestInit) {
    setOcupado(id);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/entregables/${id}`, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(null);
    }
  }

  const cambiar = (id: string, patch: Record<string, string>) =>
    llamar(id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

  const borrar = (id: string) => llamar(id, { method: "DELETE" });

  const [refrescando, setRefrescando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Vuelve a leer las vistas de las piezas publicadas. */
  async function refrescarMetricas() {
    setRefrescando(true);
    setError(null);
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
          ? "Ninguna pieza tiene video todavía."
          : `${data.actualizados} actualizada${data.actualizados === 1 ? "" : "s"}${
              data.fallidos ? `, ${data.fallidos} sin responder` : ""
            }.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setRefrescando(false);
    }
  }

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <SectionLabel className="mb-0">Entregables</SectionLabel>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={refrescarMetricas}
            disabled={refrescando || deliverables.length === 0}
          >
            {refrescando ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Actualizar
          </Button>
          <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
            <Plus size={15} />
            Añadir
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-2.5 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          {error}
        </p>
      )}

      {aviso && (
        <p className="mb-2.5 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
          {aviso}
        </p>
      )}

      {deliverables.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Sin entregables"
          description="Añade el primer video pegando su enlace de YouTube."
          action={
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={16} />
              Añadir entregable
            </Button>
          }
        />
      ) : (
        <ListBox>
          {deliverables.map((d) => {
            const creator = creators.find((c) => c.id === d.creatorId);
            const status = DELIVERABLE_STATUS[d.status];
            return (
              <ListRow
                key={d.id}
                chevron={false}
                leading={
                  d.thumbnail ? (
                    <img
                      src={d.thumbnail}
                      alt=""
                      className="h-[38px] w-[66px] shrink-0 rounded-[var(--r-control)] object-cover"
                    />
                  ) : (
                    <span className="grid h-[38px] w-[66px] shrink-0 place-items-center rounded-[var(--r-control)] bg-[var(--surface-3)] text-[var(--text-subtle)]">
                      <Film size={16} strokeWidth={1.75} />
                    </span>
                  )
                }
                title={d.title ?? "Pendiente de publicar"}
                subtitle={
                  <>
                    {creator && (
                      <span className="mr-1.5 inline-flex items-center gap-1.5 align-middle">
                        <Avatar src={creator.avatarUrl} name={creator.name} size={16} />
                        {creator.name}
                      </span>
                    )}
                    · {DELIVERABLE_TYPE[d.type]} ·{" "}
                    {d.publishedAt ? formatDate(d.publishedAt) : "sin fecha"}
                  </>
                }
                trailing={
                  <span className="flex items-center gap-3">
                    <span className="hidden text-right sm:block">
                      <span className="tabular block text-[14px] font-semibold">
                        {d.views ? formatCompact(d.views) : "—"}
                      </span>
                      <span className="block text-[11.5px] text-[var(--text-subtle)]">
                        {formatMoney(d.agreedFee, currency)}
                      </span>
                    </span>

                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone={PAGO[d.paymentStatus].tone}>
                      {PAGO[d.paymentStatus].label}
                    </Badge>

                    {/* Sin esto la pieza se quedaba estática: no había forma de
                        publicarla ni de marcar que el creador ya cobró. */}
                    <Acciones
                      deliverable={d}
                      ocupado={ocupado === d.id}
                      onCambiar={(patch) => cambiar(d.id, patch)}
                      onBorrar={() => borrar(d.id)}
                    />
                  </span>
                }
              />
            );
          })}
        </ListBox>
      )}

      <AddDeliverableDialog
        open={open}
        onClose={() => setOpen(false)}
        campaignId={campaignId}
        creators={creators}
      />
    </section>
  );
}

/**
 * Acciones de una pieza.
 *
 * Van en un menú y no sueltas en la fila: son cinco, algunas destructivas, y
 * la fila ya carga vistas, importe y dos etiquetas.
 */
function Acciones({
  deliverable,
  ocupado,
  onCambiar,
  onBorrar,
}: {
  deliverable: Deliverable;
  ocupado: boolean;
  onCambiar: (patch: Record<string, string>) => void;
  onBorrar: () => void;
}) {
  const d = deliverable;

  return (
    <Popover
      side="bottom"
      align="end"
      portal
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          disabled={ocupado}
          aria-label="Acciones del entregable"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          {ocupado ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <MoreHorizontal size={16} />
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-52 p-1">
          {d.videoUrl && (
            <>
              <Link
                href={d.videoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={close}
                className="flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-3)]"
              >
                <ExternalLink size={14} className="shrink-0" />
                Abrir en YouTube
              </Link>
              <div className="my-1 h-px bg-[var(--line)]" />
            </>
          )}

          <Grupo>Publicación</Grupo>
          {d.status !== "publicado" && (
            <Opcion
              icono={Check}
              onClick={() => {
                onCambiar({ status: "publicado" });
                close();
              }}
            >
              Marcar publicado
            </Opcion>
          )}
          {d.status !== "pendiente" && (
            <Opcion
              icono={RefreshCw}
              onClick={() => {
                onCambiar({ status: "pendiente" });
                close();
              }}
            >
              Volver a pendiente
            </Opcion>
          )}
          {d.status !== "cancelado" && (
            <Opcion
              icono={Trash2}
              onClick={() => {
                onCambiar({ status: "cancelado" });
                close();
              }}
            >
              Cancelar pieza
            </Opcion>
          )}

          <Grupo>Pago al creador</Grupo>
          {d.paymentStatus !== "aprobado" && (
            <Opcion
              icono={Wallet}
              onClick={() => {
                onCambiar({ paymentStatus: "aprobado" });
                close();
              }}
            >
              Aprobar pago
            </Opcion>
          )}
          {d.paymentStatus !== "pagado" && (
            <Opcion
              icono={Check}
              onClick={() => {
                onCambiar({ paymentStatus: "pagado" });
                close();
              }}
            >
              Marcar pagado
            </Opcion>
          )}
          {d.paymentStatus !== "pendiente" && (
            <Opcion
              icono={RefreshCw}
              onClick={() => {
                onCambiar({ paymentStatus: "pendiente" });
                close();
              }}
            >
              Marcar sin pagar
            </Opcion>
          )}

          <div className="my-1 h-px bg-[var(--line)]" />
          <Opcion
            icono={Trash2}
            peligro
            onClick={() => {
              onBorrar();
              close();
            }}
          >
            Quitar de la campaña
          </Opcion>
        </div>
      )}
    </Popover>
  );
}

function Grupo({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-[var(--text-subtle)] uppercase">
      {children}
    </p>
  );
}

function Opcion({
  icono: Icono,
  children,
  onClick,
  peligro,
}: {
  icono: typeof Check;
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
