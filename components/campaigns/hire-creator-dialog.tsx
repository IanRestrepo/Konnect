"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Package,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { FieldHint, Label } from "@/components/ui/field";
import { SearchInput } from "@/components/shell/toolbar";
import { Paginador, usePagina } from "@/components/ui/pager";
import {
  PiecesEditor,
  cuentas,
  nuevaClave,
  piezaNueva,
  type Pieza,
} from "@/components/campaigns/pieces-editor";
import { PLATFORM_LABEL, piezaLabel } from "@/lib/socials";
import { IMPORTE_MAXIMO, MARGEN_AGENCIA, repartirPaquete } from "@/lib/pricing";
import { resumenPaquete } from "@/components/creators/packages-panel";
import type { Creator, CreatorPackage, Currency, DeliverableKind } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Contrata a un creador dentro de una campaña ya empezada.
 *
 * Distinto de «Añadir entregable», que pide el enlace de un video ya
 * publicado: eso sirve para registrar lo que ya salió. Esto es lo contrario
 * —pactar trabajo que todavía no existe—, así que las piezas nacen pendientes
 * y al creador se le abre su sesión de entrega con su enlace.
 *
 * Va en dos pasos: primero a quién, después qué se le encarga. Antes era una
 * sola pantalla con una sola pieza, y a quien le pedían dos TikToks con precio
 * distinto —o un video dedicado y un Short— no tenía dónde ponerlos.
 */
export function HireCreatorDialog({
  open,
  onClose,
  campaignId,
  creators,
  currency,
  kinds,
  onKindsChange,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  creators: Creator[];
  currency: Currency;
  /** Tipos de pieza propios de la agencia, además de los de fábrica. */
  kinds: DeliverableKind[];
  onKindsChange: (kinds: DeliverableKind[]) => void;
}) {
  const router = useRouter();

  const [paso, setPaso] = useState<"creador" | "piezas">("creador");
  const [busqueda, setBusqueda] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegido = creators.find((c) => c.id === creatorId) ?? null;

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return creators.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q),
    );
  }, [creators, busqueda]);

  const pagina = usePagina(resultados, busqueda);

  function elegir(creator: Creator) {
    setError(null);
    if (creator.id === creatorId) return;
    setCreatorId(creator.id);
    // Se arranca en la red donde de verdad publica, no siempre en YouTube.
    setPiezas([piezaNueva(creator, creator.mainPlatform)]);
  }

  /** Un paquete se convierte en sus piezas, que todavía se pueden retocar. */
  function usarPaquete(pkg: CreatorPackage) {
    if (!elegido) return;
    setPiezas(
      repartirPaquete(elegido, pkg, MARGEN_AGENCIA).map((p) => ({
        key: nuevaClave(),
        platform: p.platform,
        type: p.type,
        customType: p.customType,
        channelId: "",
        cobro: p.clientPrice > 0 ? String(p.clientPrice) : "",
        costo: p.creatorCost > 0 ? String(p.creatorCost) : "",
        paquete: pkg.name,
      })),
    );
    setError(null);
    setPaso("piezas");
  }

  function cerrar() {
    setPaso("creador");
    setBusqueda("");
    setCreatorId("");
    setPiezas([]);
    setError(null);
    onClose();
  }

  const totales = piezas.reduce(
    (acc, p) => {
      const c = cuentas(p);
      return { cobro: acc.cobro + c.cobro, costo: acc.costo + c.costo, ganancia: acc.ganancia + c.ganancia };
    },
    { cobro: 0, costo: 0, ganancia: 0 },
  );

  async function guardar() {
    if (!elegido) return;
    if (piezas.length === 0) {
      setError("Añade al menos un entregable.");
      return;
    }
    if (piezas.some((p) => Number(p.cobro) > IMPORTE_MAXIMO || Number(p.costo) > IMPORTE_MAXIMO)) {
      setError("Uno de los importes se pasa del máximo.");
      return;
    }
    const negativa = piezas.find((p) => cuentas(p).ganancia < 0);
    if (negativa) {
      setError(
        `En «${piezaLabel(negativa.platform, negativa.type, negativa.customType)}» el pago al creador supera lo que paga el cliente.`,
      );
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/creadores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: elegido.id,
          piezas: piezas.map((p) => ({
            platform: p.platform,
            type: p.type,
            customType: p.customType,
            channelId: p.channelId,
            clientPrice: Number(p.cobro) || 0,
            creatorCost: Number(p.costo) || 0,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo contratar al creador.");
      router.refresh();
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  const avisoError = error && (
    <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
      <TriangleAlert size={14} className="mt-px shrink-0" />
      {error}
    </p>
  );

  if (paso === "piezas" && elegido) {
    return (
      <Modal
        open={open}
        onClose={cerrar}
        size="xl"
        icon={UserPlus}
        title="Qué se le encarga"
        description="Una fila por pieza, cada una con su precio. Todas aparecen en su checklist del portal."
        footerNote={
          <span className="tabular">
            Cobras {formatMoney(totales.cobro, currency)} · le pagas {formatMoney(totales.costo, currency)} ·{" "}
            <span className={totales.ganancia < 0 ? "text-[var(--danger)]" : "font-medium text-[var(--text)]"}>
              quedan {formatMoney(totales.ganancia, currency)}
            </span>
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaso("creador")} disabled={guardando}>
              <ArrowLeft size={14} />
              Atrás
            </Button>
            <Button variant="primary" onClick={guardar} disabled={guardando || piezas.length === 0}>
              {guardando && <LoaderCircle size={14} className="animate-spin" />}
              Contratar {piezas.length === 1 ? "1 pieza" : `${piezas.length} piezas`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {avisoError}

          <div className="flex items-center gap-3 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2">
            <Avatar src={elegido.avatarUrl} name={elegido.name} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{elegido.name}</span>
              <span className="block truncate text-[12px] text-[var(--text-subtle)]">
                {elegido.categories.join(", ")} · {PLATFORM_LABEL[elegido.mainPlatform]}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setPaso("creador")}
              className="shrink-0 text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Cambiar
            </button>
          </div>

          <PiecesEditor
            creator={elegido}
            piezas={piezas}
            onChange={setPiezas}
            currency={currency}
            kinds={kinds}
            onKindsChange={onKindsChange}
          />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      size="lg"
      icon={UserPlus}
      title="Añadir creador a la campaña"
      description="Elige a quién contratas. En el paso siguiente le pones los entregables y sus precios."
      footerNote={elegido ? undefined : "Elige a quién contratas"}
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              setPaso("piezas");
            }}
            disabled={!elegido}
          >
            Siguiente: entregables
            <ArrowRight size={14} />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {avisoError}

        <div>
          <Label>Creador</Label>
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre o usuario"
          />
          <div className="mt-2 space-y-1.5">
            {resultados.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-[var(--text-muted)]">
                Ningún creador con ese nombre.
              </p>
            ) : (
              pagina.visibles.map((creator) => {
                const activo = creator.id === creatorId;
                return (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => elegir(creator)}
                    // Doble clic: elegir y pasar a los entregables de una vez.
                    onDoubleClick={() => {
                      elegir(creator);
                      setPaso("piezas");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[var(--r-control)] border p-2.5 text-left transition",
                      activo
                        ? "border-[var(--text)] bg-[var(--surface-2)]"
                        : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]",
                    )}
                  >
                    <Avatar src={creator.avatarUrl} name={creator.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{creator.name}</span>
                      <span className="block truncate text-[12px] text-[var(--text-subtle)]">
                        {creator.categories.join(", ")} · {PLATFORM_LABEL[creator.mainPlatform]}
                      </span>
                    </span>
                    {activo && <Check size={15} className="shrink-0 text-[var(--accent)]" />}
                  </button>
                );
              })
            )}
            <Paginador {...pagina} className="pt-1" />
          </div>
        </div>

        {elegido && elegido.packages.length > 0 && (
          <div>
            <Label>Sus paquetes</Label>
            <div className="space-y-1.5">
              {elegido.packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => usarPaquete(pkg)}
                  className="flex w-full items-center gap-3 rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] px-3 py-2 text-left transition hover:border-[var(--accent)]"
                >
                  <Package size={15} className="shrink-0 text-[var(--text-subtle)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{pkg.name}</span>
                    <span className="block truncate text-[12px] text-[var(--text-muted)]">
                      {resumenPaquete(pkg.items)}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[13px] font-semibold">
                    {formatMoney(pkg.price, elegido.currency)}
                  </span>
                </button>
              ))}
            </div>
            <FieldHint>Pone todas sus piezas en el paso siguiente, con el precio repartido.</FieldHint>
          </div>
        )}
      </div>
    </Modal>
  );
}
