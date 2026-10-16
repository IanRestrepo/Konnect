"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  LoaderCircle,
  Package,
  Plus,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { SearchInput } from "@/components/shell/toolbar";
import { Paginador, usePagina } from "@/components/ui/pager";
import { DeliverableTypeField } from "@/components/campaigns/deliverable-type-field";
import { PLATFORM_LABEL, PLATFORMS, TAREAS, nombreCanal, piezaLabel } from "@/lib/socials";
import {
  IMPORTE_MAXIMO,
  MARGEN_AGENCIA,
  clientPriceForRate,
  rateFor,
  repartirPaquete,
  tarifaCanal,
} from "@/lib/pricing";
import { resumenPaquete } from "@/components/creators/packages-panel";
import type {
  Creator,
  CreatorPackage,
  Currency,
  DeliverableKind,
  DeliverableType,
  SocialPlatform,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/** Si el creador tiene perfil en esa red, o publica principalmente ahí. */
function estaEn(creator: Creator, platform: SocialPlatform) {
  return creator.mainPlatform === platform || creator.socials.some((s) => s.platform === platform);
}

/** Una pieza del encargo, tal como se edita: los importes como texto del campo. */
type Pieza = {
  key: number;
  platform: SocialPlatform;
  type: DeliverableType;
  /** Nombre propio del encargo. Vacío = la tarea estándar de esa red. */
  customType: string;
  channelId: string;
  cobro: string;
  costo: string;
  /** De qué paquete salió, si salió de uno. */
  paquete?: string;
};

/** Lo que se propone cobrar y pagar con la tarifa del creador para esa pieza. */
function propuesta(
  creator: Creator,
  red: SocialPlatform,
  pieza: DeliverableType,
  canal: string,
): Pick<Pieza, "cobro" | "costo"> {
  const tarifa = rateFor(creator, red, pieza, canal);
  return {
    costo: tarifa > 0 ? String(tarifa) : "",
    // Lo que se le cobra al cliente incluye la comisión: si pide 1.000 y la
    // agencia se lleva el 20%, hay que cobrar 1.250, no 1.200.
    cobro: tarifa > 0 ? String(Math.round(clientPriceForRate(tarifa, MARGEN_AGENCIA))) : "",
  };
}

function cuentas(p: Pieza) {
  const cobro = Number(p.cobro) || 0;
  const costo = Number(p.costo) || 0;
  return { cobro, costo, ganancia: cobro - costo };
}

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
  const siguiente = useRef(1);

  const elegido = creators.find((c) => c.id === creatorId) ?? null;

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return creators.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q),
    );
  }, [creators, busqueda]);

  const pagina = usePagina(resultados, busqueda);

  /** Una pieza nueva en esa red, con la primera tarea que admite y su tarifa. */
  function piezaNueva(creator: Creator, red: SocialPlatform, base?: Pieza): Pieza {
    const type = base?.type ?? TAREAS[red][0]?.type ?? "video";
    const customType = base?.customType ?? "";
    const channelId = base?.channelId ?? "";
    return {
      key: siguiente.current++,
      platform: red,
      type,
      customType,
      channelId,
      ...propuesta(creator, red, type, channelId),
    };
  }

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
        key: siguiente.current++,
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

  function editar(key: number, patch: Partial<Pieza>) {
    setPiezas((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function quitar(key: number) {
    setPiezas((prev) => prev.filter((p) => p.key !== key));
  }

  /** Otra pieza igual a esa, justo debajo, para cambiarle solo el precio. */
  function duplicar(pieza: Pieza) {
    setPiezas((prev) => {
      const i = prev.findIndex((p) => p.key === pieza.key);
      const copia = { ...pieza, key: siguiente.current++, paquete: undefined };
      return [...prev.slice(0, i + 1), copia, ...prev.slice(i + 1)];
    });
  }

  /** Otra pieza al final, en la misma red que la última: suele ser lo que se pide. */
  function anadir() {
    if (!elegido) return;
    const ultima = piezas.at(-1);
    setPiezas((prev) => [...prev, piezaNueva(elegido, ultima?.platform ?? elegido.mainPlatform)]);
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

          {piezas.length === 0 && (
            <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">
              Sin entregables todavía. Añade el primero.
            </p>
          )}

          {piezas.map((p, i) => {
            const { ganancia } = cuentas(p);
            const conCanales = p.platform === "youtube" && elegido.channels.length > 0;
            return (
              <div
                key={p.key}
                className="rounded-[var(--r-card)] border border-[var(--line)] p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-5 min-w-5 place-items-center rounded-[var(--r-chip)] bg-[var(--surface-3)] px-1 text-[11px] font-semibold tabular">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {piezaLabel(p.platform, p.type, p.customType)}
                    <span className="font-normal text-[var(--text-muted)]">
                      {" "}· {PLATFORM_LABEL[p.platform]}
                      {p.paquete && ` · paquete «${p.paquete}»`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => duplicar(p)}
                    title="Otra pieza igual, con su propio precio"
                    className="inline-flex h-7 items-center gap-1 rounded-[var(--r-chip)] px-2 text-[12px] text-[var(--text-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                  >
                    <Copy size={12} />
                    Otra igual
                  </button>
                  <button
                    type="button"
                    onClick={() => quitar(p.key)}
                    aria-label={`Quitar la pieza ${i + 1}`}
                    className="grid h-7 w-7 place-items-center rounded-[var(--r-chip)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`hc-red-${p.key}`}>Red</Label>
                    <Picker
                      id={`hc-red-${p.key}`}
                      value={p.platform}
                      onChange={(red) => {
                        // Con un tipo propio elegido, la pieza no cambia al
                        // cambiar de red: «Unboxing» vale igual en YouTube que
                        // en TikTok.
                        const type =
                          p.customType || TAREAS[red].some((t) => t.type === p.type)
                            ? p.type
                            : (TAREAS[red][0]?.type ?? "video");
                        // Los canales son de YouTube: fuera de ahí no aplican.
                        const channelId = red === "youtube" ? p.channelId : "";
                        editar(p.key, {
                          platform: red,
                          type,
                          channelId,
                          ...propuesta(elegido, red, type, channelId),
                        });
                      }}
                      options={PLATFORMS.map((pl) => ({
                        id: pl.id,
                        label: pl.label,
                        hint: estaEn(elegido, pl.id) ? "Su red" : undefined,
                      }))}
                    />
                  </div>

                  <DeliverableTypeField
                    id={`hc-pieza-${p.key}`}
                    platform={p.platform}
                    type={p.type}
                    customType={p.customType}
                    kinds={kinds}
                    onChange={(type, customType) =>
                      editar(p.key, {
                        type,
                        customType,
                        ...propuesta(elegido, p.platform, type, p.channelId),
                      })
                    }
                    onKindsChange={onKindsChange}
                  />

                  {conCanales && (
                    <div className="sm:col-span-2">
                      <Label htmlFor={`hc-canal-${p.key}`}>Canal</Label>
                      <Picker
                        id={`hc-canal-${p.key}`}
                        value={p.channelId}
                        onChange={(channelId) =>
                          editar(p.key, {
                            channelId,
                            ...propuesta(elegido, p.platform, p.type, channelId),
                          })
                        }
                        options={[
                          {
                            id: "",
                            label: elegido.handle || "Canal principal",
                            hint: `Principal · ${tarifaCanal(elegido, p.platform, p.type, "")}`,
                          },
                          ...elegido.channels.map((c) => ({
                            id: c.id,
                            label: nombreCanal(c),
                            hint: [tarifaCanal(elegido, p.platform, p.type, c.id), ...c.tags].join(" · "),
                          })),
                        ]}
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor={`hc-cobro-${p.key}`}>Pago del cliente</Label>
                    <Input
                      id={`hc-cobro-${p.key}`}
                      type="number"
                      min={0}
                      value={p.cobro}
                      onChange={(e) => editar(p.key, { cobro: e.target.value })}
                      placeholder="0"
                      className="tabular"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`hc-costo-${p.key}`}>Pago al creador</Label>
                    <Input
                      id={`hc-costo-${p.key}`}
                      type="number"
                      min={0}
                      value={p.costo}
                      onChange={(e) => editar(p.key, { costo: e.target.value })}
                      placeholder="0"
                      className="tabular"
                    />
                  </div>
                </div>

                <p
                  className={cn(
                    "mt-2 text-right text-[12px] tabular",
                    ganancia < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
                  )}
                >
                  Quedan {formatMoney(ganancia, currency)}
                </p>
              </div>
            );
          })}

          <Button variant="secondary" onClick={anadir} className="w-full">
            <Plus size={14} />
            Añadir otro entregable
          </Button>
          <FieldHint>
            Para dos piezas iguales con precio distinto —dos TikToks, por ejemplo— usa «Otra igual» y
            cambia el precio.
          </FieldHint>
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
