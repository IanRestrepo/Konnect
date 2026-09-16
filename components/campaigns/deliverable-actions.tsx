"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, LoaderCircle, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import type { Deliverable } from "@/lib/types";

/**
 * Las acciones de una pieza, en un menú.
 *
 * Vivían en la lista de entregables de la campaña, que mezclaba las piezas de
 * todos los creadores sin agrupar. Ahora cada pieza se gestiona desde la ficha
 * de su creador dentro de la campaña, que es donde se mira lo suyo, y el
 * trabajo del día a día —entregas, fechas, revisión— pasa por la sesión
 * maestra. El menú se trae entero para no perder nada por el camino.
 *
 * El pago no está aquí: se lleva por creador, porque se paga lo que se le
 * debe y no video a video.
 */
export function DeliverableActions({
  campaignId,
  deliverable: d,
  onEditar,
  onBorrada,
  onError,
}: {
  campaignId: string;
  deliverable: Deliverable;
  onEditar: () => void;
  /** Después de quitarla. Sirve para salir si era la última pieza. */
  onBorrada?: () => void;
  onError: (mensaje: string) => void;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function llamar(init: RequestInit): Promise<boolean> {
    setOcupado(true);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/entregables/${d.id}`, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar la pieza.");
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error inesperado");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function estado(status: Deliverable["status"]) {
    const ok = await llamar({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (ok) router.refresh();
  }

  async function quitar() {
    const seguro = window.confirm(
      d.paymentStatus === "pagado"
        ? "Esta pieza ya está pagada. Si la quitas, ese pago desaparece de los informes. ¿Seguir?"
        : "¿Quitar esta pieza de la campaña? Si todavía no se entregó, sale también del checklist del creador.",
    );
    if (!seguro) return;
    if (await llamar({ method: "DELETE" })) {
      if (onBorrada) onBorrada();
      else router.refresh();
    }
  }

  return (
    <Popover
      side="bottom"
      align="end"
      portal
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          disabled={ocupado}
          aria-label="Acciones de la pieza"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          {ocupado ? <LoaderCircle size={15} className="animate-spin" /> : <MoreHorizontal size={16} />}
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-52 p-1">
          <Opcion
            icono={Pencil}
            onClick={() => {
              close();
              onEditar();
            }}
          >
            Editar la pieza
          </Opcion>

          {d.videoUrl && (
            <Link
              href={d.videoUrl}
              target="_blank"
              rel="noreferrer"
              onClick={close}
              className="flex w-full items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-3)]"
            >
              <ExternalLink size={14} className="shrink-0" />
              Abrir la publicación
            </Link>
          )}

          <div className="my-1 h-px bg-[var(--line)]" />
          <p className="px-2.5 pt-1 pb-1 text-[11px] font-medium tracking-wide text-[var(--text-subtle)] uppercase">
            Publicación
          </p>
          {d.status !== "publicado" && (
            <Opcion
              icono={Check}
              onClick={() => {
                close();
                void estado("publicado");
              }}
            >
              Marcar publicado
            </Opcion>
          )}
          {d.status !== "pendiente" && (
            <Opcion
              icono={RefreshCw}
              onClick={() => {
                close();
                void estado("pendiente");
              }}
            >
              Volver a pendiente
            </Opcion>
          )}
          {d.status !== "cancelado" && (
            <Opcion
              icono={Trash2}
              onClick={() => {
                close();
                void estado("cancelado");
              }}
            >
              Cancelar pieza
            </Opcion>
          )}

          <div className="my-1 h-px bg-[var(--line)]" />
          <Opcion
            icono={Trash2}
            peligro
            onClick={() => {
              close();
              void quitar();
            }}
          >
            Quitar de la campaña
          </Opcion>
        </div>
      )}
    </Popover>
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
