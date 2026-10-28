"use client";

import { Copy, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { DeliverableTypeField } from "@/components/campaigns/deliverable-type-field";
import { PLATFORM_LABEL, PLATFORMS, TAREAS, nombreCanal, piezaLabel } from "@/lib/socials";
import { clientRateFor, rateFor, tarifaCanal } from "@/lib/pricing";
import type {
  Creator,
  Currency,
  DeliverableKind,
  DeliverableType,
  SocialPlatform,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Editor de lo que se le encarga a un creador: una fila por pieza, cada una
 * con su red, su tipo y sus dos importes.
 *
 * Lo usan el alta de campaña y «Añadir creador a la campaña». Vive aparte
 * porque en el alta solo se podía poner una pieza por red y tipo, y a quien
 * le pedían un TikTok, dos historias y un directo no le cabía.
 */

/** Una pieza del encargo, tal como se edita: los importes como texto del campo. */
export type Pieza = {
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

let siguienteClave = 1;
/** Clave estable para cada fila; React la necesita al quitar o duplicar. */
export const nuevaClave = () => siguienteClave++;

/** Si el creador tiene perfil en esa red, o publica principalmente ahí. */
function estaEn(creator: Creator, platform: SocialPlatform) {
  return creator.mainPlatform === platform || creator.socials.some((s) => s.platform === platform);
}

/** Lo que se propone cobrar y pagar con la tarifa del creador para esa pieza. */
export function propuesta(
  creator: Creator,
  red: SocialPlatform,
  pieza: DeliverableType,
  canal: string,
): Pick<Pieza, "cobro" | "costo"> {
  const tarifa = rateFor(creator, red, pieza, canal);
  return {
    costo: tarifa > 0 ? String(tarifa) : "",
    // El precio al cliente de su tarifa, o la tarifa con el margen encima.
    cobro: String(clientRateFor(creator, red, pieza, canal) || ""),
  };
}

export function cuentas(p: Pick<Pieza, "cobro" | "costo">) {
  const cobro = Number(p.cobro) || 0;
  const costo = Number(p.costo) || 0;
  return { cobro, costo, ganancia: cobro - costo };
}

/** Una pieza nueva en esa red, con la tarea pedida o la primera que admite, y su tarifa. */
export function piezaNueva(
  creator: Creator,
  red: SocialPlatform,
  tipo?: { type: DeliverableType; customType: string },
): Pieza {
  const type = tipo?.type ?? TAREAS[red][0]?.type ?? "video";
  const customType = tipo?.customType ?? "";
  return {
    key: nuevaClave(),
    platform: red,
    type,
    customType,
    channelId: "",
    ...propuesta(creator, red, type, ""),
  };
}

export function PiecesEditor({
  creator,
  piezas,
  onChange,
  currency,
  kinds,
  onKindsChange,
}: {
  creator: Creator;
  piezas: Pieza[];
  onChange: (piezas: Pieza[]) => void;
  currency: Currency;
  kinds: DeliverableKind[];
  onKindsChange: (kinds: DeliverableKind[]) => void;
}) {
  const editar = (key: number, patch: Partial<Pieza>) =>
    onChange(piezas.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const quitar = (key: number) => onChange(piezas.filter((p) => p.key !== key));

  /** Otra pieza igual a esa, justo debajo, para cambiarle solo el precio. */
  const duplicar = (pieza: Pieza) => {
    const i = piezas.findIndex((p) => p.key === pieza.key);
    const copia = { ...pieza, key: nuevaClave(), paquete: undefined };
    onChange([...piezas.slice(0, i + 1), copia, ...piezas.slice(i + 1)]);
  };

  /** Otra pieza al final, en la misma red que la última: suele ser lo que se pide. */
  const anadir = () => {
    const ultima = piezas.at(-1);
    onChange([...piezas, piezaNueva(creator, ultima?.platform ?? creator.mainPlatform)]);
  };

  return (
    <div className="space-y-3">
      {piezas.length === 0 && (
        <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">
          Sin entregables todavía. Añade el primero.
        </p>
      )}

      {piezas.map((p, i) => {
        const { ganancia } = cuentas(p);
        const conCanales = p.platform === "youtube" && creator.channels.length > 0;
        return (
          <div key={p.key} className="rounded-[var(--r-card)] border border-[var(--line)] p-3">
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
                <Label htmlFor={`pz-red-${p.key}`}>Red</Label>
                <Picker
                  id={`pz-red-${p.key}`}
                  value={p.platform}
                  onChange={(red) => {
                    // Con un tipo propio elegido, la pieza no cambia al cambiar
                    // de red: «Unboxing» vale igual en YouTube que en TikTok.
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
                      ...propuesta(creator, red, type, channelId),
                    });
                  }}
                  options={PLATFORMS.map((pl) => ({
                    id: pl.id,
                    label: pl.label,
                    hint: estaEn(creator, pl.id) ? "Su red" : undefined,
                  }))}
                />
              </div>

              <DeliverableTypeField
                id={`pz-pieza-${p.key}`}
                platform={p.platform}
                type={p.type}
                customType={p.customType}
                kinds={kinds}
                onChange={(type, customType) =>
                  editar(p.key, {
                    type,
                    customType,
                    ...propuesta(creator, p.platform, type, p.channelId),
                  })
                }
                onKindsChange={onKindsChange}
              />

              {conCanales && (
                <div className="sm:col-span-2">
                  <Label htmlFor={`pz-canal-${p.key}`}>Canal</Label>
                  <Picker
                    id={`pz-canal-${p.key}`}
                    value={p.channelId}
                    onChange={(channelId) =>
                      editar(p.key, {
                        channelId,
                        ...propuesta(creator, p.platform, p.type, channelId),
                      })
                    }
                    options={[
                      {
                        id: "",
                        label: creator.handle || "Canal principal",
                        hint: `Principal · ${tarifaCanal(creator, p.platform, p.type, "")}`,
                      },
                      ...creator.channels.map((c) => ({
                        id: c.id,
                        label: nombreCanal(c),
                        hint: [tarifaCanal(creator, p.platform, p.type, c.id), ...c.tags].join(" · "),
                      })),
                    ]}
                  />
                </div>
              )}

              <div>
                <Label htmlFor={`pz-cobro-${p.key}`}>Pago del cliente</Label>
                <Input
                  id={`pz-cobro-${p.key}`}
                  type="number"
                  min={0}
                  value={p.cobro}
                  onChange={(e) => editar(p.key, { cobro: e.target.value })}
                  placeholder="0"
                  className="tabular"
                />
              </div>

              <div>
                <Label htmlFor={`pz-costo-${p.key}`}>Pago al creador</Label>
                <Input
                  id={`pz-costo-${p.key}`}
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
        Una fila por pieza: un TikTok, dos historias y un directo son cuatro filas. Para dos piezas
        iguales con precio distinto, usa «Otra igual» y cambia el precio.
      </FieldHint>
    </div>
  );
}
