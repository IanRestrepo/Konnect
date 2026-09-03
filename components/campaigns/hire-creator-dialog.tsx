"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, TriangleAlert, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { SearchInput } from "@/components/shell/toolbar";
import { PLATFORM_LABEL, PLATFORMS, TAREAS, tareaLabel } from "@/lib/socials";
import { IMPORTE_MAXIMO, clientPriceForRate, rateFor } from "@/lib/pricing";
import type { Creator, Currency, DeliverableType, SocialPlatform } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/** Si el creador tiene perfil en esa red, o publica principalmente ahí. */
function estaEn(creator: Creator, platform: SocialPlatform) {
  return creator.mainPlatform === platform || creator.socials.some((s) => s.platform === platform);
}

/**
 * Contrata a un creador dentro de una campaña ya empezada.
 *
 * Distinto de «Añadir entregable», que pide el enlace de un video ya
 * publicado: eso sirve para registrar lo que ya salió. Esto es lo contrario
 * —pactar trabajo que todavía no existe—, así que la pieza nace pendiente y al
 * creador se le abre su sesión de entrega con su código.
 */
export function HireCreatorDialog({
  open,
  onClose,
  campaignId,
  creators,
  agencyFee,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  creators: Creator[];
  /** Comisión por defecto de la campaña, para proponer el cobro. */
  agencyFee: number;
  currency: Currency;
}) {
  const router = useRouter();

  const [busqueda, setBusqueda] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("youtube");
  const [tipo, setTipo] = useState<DeliverableType>("video");
  const [channelId, setChannelId] = useState("");
  const [cobro, setCobro] = useState("");
  const [costo, setCosto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegido = creators.find((c) => c.id === creatorId) ?? null;

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return creators
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q))
      .slice(0, 40);
  }, [creators, busqueda]);

  /** Propone el precio con la tarifa del creador para esa red y pieza. */
  function proponer(
    creator: Creator,
    red: SocialPlatform,
    pieza: DeliverableType,
    canal: string,
  ) {
    const tarifa = rateFor(creator, red, pieza, canal);
    setCosto(tarifa > 0 ? String(tarifa) : "");
    // Lo que se le cobra al cliente incluye la comisión: si pide 1.000 y la
    // agencia se lleva el 20%, hay que cobrar 1.250, no 1.200.
    setCobro(tarifa > 0 ? String(Math.round(clientPriceForRate(tarifa, agencyFee))) : "");
  }

  function elegir(creator: Creator) {
    setCreatorId(creator.id);
    setError(null);
    // Se arranca en la red donde de verdad publica, no siempre en YouTube.
    const red = creator.mainPlatform;
    const pieza = TAREAS[red][0]?.type ?? "video";
    setPlatform(red);
    setTipo(pieza);
    setChannelId("");
    proponer(creator, red, pieza, "");
  }

  function cerrar() {
    setBusqueda("");
    setCreatorId("");
    setChannelId("");
    setCobro("");
    setCosto("");
    setError(null);
    onClose();
  }

  const ganancia = (Number(cobro) || 0) - (Number(costo) || 0);

  async function guardar() {
    if (!elegido) return;
    if (Number(cobro) > IMPORTE_MAXIMO || Number(costo) > IMPORTE_MAXIMO) {
      setError("Ese importe se pasa del máximo.");
      return;
    }
    if (ganancia < 0) {
      setError("El pago al creador no puede superar lo que paga el cliente.");
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
          platform,
          type: tipo,
          channelId,
          clientPrice: Number(cobro) || 0,
          creatorCost: Number(costo) || 0,
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

  return (
    <Modal
      open={open}
      onClose={cerrar}
      size="lg"
      icon={UserPlus}
      title="Añadir creador a la campaña"
      description="Se pacta la pieza y se le abre su sesión de entrega con su código."
      footerNote={elegido ? undefined : "Elige a quién contratas"}
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!elegido || guardando}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            Contratar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <div>
          <Label>Creador</Label>
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre o usuario"
          />
          <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
            {resultados.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-[var(--text-muted)]">
                Ningún creador con ese nombre.
              </p>
            ) : (
              resultados.map((creator) => {
                const activo = creator.id === creatorId;
                return (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => elegir(creator)}
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
                        {creator.category} · {PLATFORM_LABEL[creator.mainPlatform]}
                      </span>
                    </span>
                    {activo && <Check size={15} className="shrink-0 text-[var(--accent)]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {elegido && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="hc-red">Red</Label>
                <Picker
                  id="hc-red"
                  value={platform}
                  onChange={(red) => {
                    const pieza = TAREAS[red].some((t) => t.type === tipo)
                      ? tipo
                      : (TAREAS[red][0]?.type ?? "video");
                    setPlatform(red);
                    setTipo(pieza);
                    // Los canales son de YouTube: fuera de ahí no aplican.
                    const canal = red === "youtube" ? channelId : "";
                    setChannelId(canal);
                    proponer(elegido, red, pieza, canal);
                  }}
                  options={PLATFORMS.map((p) => ({
                    id: p.id,
                    label: p.label,
                    hint: estaEn(elegido, p.id) ? "Su red" : undefined,
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="hc-pieza">Qué se le encarga</Label>
                <Picker
                  id="hc-pieza"
                  value={tipo}
                  onChange={(pieza) => {
                    setTipo(pieza);
                    proponer(elegido, platform, pieza, channelId);
                  }}
                  options={TAREAS[platform].map((t) => ({ id: t.type, label: t.label }))}
                />
              </div>

              {platform === "youtube" && elegido.channels.length > 0 && (
                <div className="sm:col-span-2">
                  <Label htmlFor="hc-canal">Canal</Label>
                  <Picker
                    id="hc-canal"
                    value={channelId}
                    onChange={(canal) => {
                      setChannelId(canal);
                      proponer(elegido, platform, tipo, canal);
                    }}
                    options={[
                      { id: "", label: "Canal principal", hint: elegido.handle },
                      ...elegido.channels.map((c) => ({
                        id: c.id,
                        label: c.label || c.handle || "Canal",
                        hint: c.handle,
                      })),
                    ]}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="hc-cobro">Pago del cliente</Label>
                <Input
                  id="hc-cobro"
                  type="number"
                  min={0}
                  value={cobro}
                  onChange={(e) => setCobro(e.target.value)}
                  placeholder="0"
                  className="tabular"
                />
              </div>

              <div>
                <Label htmlFor="hc-costo">Pago al creador</Label>
                <Input
                  id="hc-costo"
                  type="number"
                  min={0}
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  placeholder="0"
                  className="tabular"
                />
              </div>
            </div>

            {/* Las tres cifras a la vista, como en el alta de campaña: no debe
                quedar duda de a dónde va cada peso. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
              <span className="text-[var(--text-muted)]">
                Cobras {formatMoney(Number(cobro) || 0, currency)}
              </span>
              <span className="text-[var(--text-subtle)]">·</span>
              <span className="text-[var(--text-muted)]">
                le pagas {formatMoney(Number(costo) || 0, currency)}
              </span>
              <span className="text-[var(--text-subtle)]">·</span>
              <span className={ganancia < 0 ? "text-[var(--danger)]" : "font-medium"}>
                quedan {formatMoney(ganancia, currency)}
              </span>
            </div>

            <FieldHint>
              La pieza nace pendiente: será «{tareaLabel(platform, tipo)}» y aparecerá en su
              checklist del portal.
            </FieldHint>
          </>
        )}
      </div>
    </Modal>
  );
}
