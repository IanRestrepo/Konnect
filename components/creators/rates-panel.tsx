"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, TriangleAlert, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { useCan } from "@/components/session-provider";
import { PLATFORMS, PLATFORM_LABEL, TAREAS, nombreCanal, tareaLabel } from "@/lib/socials";
import { IMPORTE_MAXIMO } from "@/lib/pricing";
import type {
  Creator,
  CreatorChannel,
  CreatorRate,
  DeliverableType,
  SocialPlatform,
} from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/** Opción de «toda la red», que es lo que vale si no se elige canal. */
const TODA_LA_RED = "";

/** Un bloque del panel: una red, o un canal secundario de YouTube. */
type Grupo = { platform: SocialPlatform; channelId: string };

const clave = (g: Grupo) => `${g.platform}|${g.channelId}`;

/**
 * Precio base del creador por red y tipo de pieza.
 *
 * Es lo que el creador quiere recibir, no lo que se le cobra al cliente: al
 * armar una campaña sale como precio de partida y de ahí se calcula el cobro
 * con la comisión de la agencia.
 *
 * Va agrupado por red. Antes era una lista de filas con tres selectores cada
 * una —red, pieza, canal— y un creador con cinco redes acababa con veinte
 * filas iguales que había que leer una a una. Ahora cada red es un bloque con
 * sus piezas ya escritas, y editar es rellenar la casilla de al lado.
 */
export function RatesPanel({
  creatorId,
  rates,
  currency,
  socials,
  mainPlatform,
  channels,
}: {
  creatorId: string;
  rates: CreatorRate[];
  currency: Creator["currency"];
  socials: SocialPlatform[];
  mainPlatform: SocialPlatform;
  /** Canales secundarios, para poder ponerles un mínimo propio. */
  channels: CreatorChannel[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [editando, setEditando] = useState(false);
  /** Grupos abiertos en la edición, en orden. */
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  /** Precio escrito por grupo y pieza: `borrador[clave][type]`. */
  const [borrador, setBorrador] = useState<Record<string, Partial<Record<DeliverableType, string>>>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las suyas primero, sin repetir.
  const suyas = [...new Set([mainPlatform, ...socials])];

  /**
   * Las piezas de un grupo: las de su red y, detrás, las que tengan precio
   * guardado sin estar en la lista —tarifas antiguas—, para no perderlas al
   * guardar ni esconderlas.
   */
  function tareasDe(g: Grupo): { type: DeliverableType; label: string }[] {
    const propias = TAREAS[g.platform];
    const sueltas = rates
      .filter((r) => r.platform === g.platform && r.channelId === g.channelId)
      .filter((r) => !propias.some((t) => t.type === r.type))
      .map((r) => ({ type: r.type, label: tareaLabel(r.platform, r.type) }));
    return [...propias, ...sueltas];
  }

  /** Los grupos con algún precio, en el orden de sus redes. */
  function gruposConPrecio(): Grupo[] {
    const vistos = new Map<string, Grupo>();
    for (const r of rates) {
      const g = { platform: r.platform, channelId: r.channelId };
      vistos.set(clave(g), g);
    }
    return ordenar([...vistos.values()]);
  }

  function ordenar(lista: Grupo[]): Grupo[] {
    const peso = (p: SocialPlatform) => {
      const i = suyas.indexOf(p);
      return i >= 0 ? i : suyas.length + PLATFORMS.findIndex((x) => x.id === p);
    };
    return [...lista].sort(
      (a, b) =>
        peso(a.platform) - peso(b.platform) ||
        // La red entera antes que sus canales secundarios.
        (a.channelId ? 1 : 0) - (b.channelId ? 1 : 0),
    );
  }

  function empezar() {
    // Sus redes siempre, aunque no tengan precio: son las que se le encargan.
    const base = new Map<string, Grupo>();
    for (const p of suyas) base.set(clave({ platform: p, channelId: TODA_LA_RED }), { platform: p, channelId: TODA_LA_RED });
    for (const g of gruposConPrecio()) base.set(clave(g), g);

    const inicial: Record<string, Partial<Record<DeliverableType, string>>> = {};
    for (const r of rates) {
      const k = clave(r);
      inicial[k] = { ...inicial[k], [r.type]: String(r.amount) };
    }
    setGrupos(ordenar([...base.values()]));
    setBorrador(inicial);
    setError(null);
    setEditando(true);
  }

  function escribir(g: Grupo, type: DeliverableType, valor: string) {
    const k = clave(g);
    setBorrador((prev) => ({ ...prev, [k]: { ...prev[k], [type]: valor } }));
  }

  function quitarGrupo(g: Grupo) {
    const k = clave(g);
    setGrupos((prev) => prev.filter((x) => clave(x) !== k));
    setBorrador((prev) => {
      const { [k]: _fuera, ...resto } = prev;
      void _fuera;
      return resto;
    });
  }

  function anadirGrupo(g: Grupo) {
    if (grupos.some((x) => clave(x) === clave(g))) return;
    setGrupos((prev) => ordenar([...prev, g]));
  }

  async function guardar() {
    const limpio = grupos.flatMap((g) =>
      tareasDe(g)
        .map((t) => ({
          platform: g.platform,
          type: t.type,
          amount: Number(borrador[clave(g)]?.[t.type]) || 0,
          channelId: g.channelId,
        }))
        .filter((f) => f.amount > 0),
    );

    if (limpio.some((f) => f.amount > IMPORTE_MAXIMO)) {
      setError("Alguna tarifa es demasiado grande para guardarla.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/tarifas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: limpio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron guardar las tarifas.");
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  const titulo = (g: Grupo) => {
    if (!g.channelId) return PLATFORM_LABEL[g.platform];
    const canal = channels.find((c) => c.id === g.channelId);
    return canal ? nombreCanal(canal) : "Canal borrado";
  };

  // Lo que aún se puede añadir en la edición: otras redes y canales de YouTube.
  const faltan = [
    ...PLATFORMS.filter((p) => !grupos.some((g) => g.platform === p.id && !g.channelId)).map((p) => ({
      id: `${p.id}|`,
      label: p.label,
      hint: suyas.includes(p.id) ? "Su red" : undefined,
    })),
    ...channels
      .filter((c) => !grupos.some((g) => g.channelId === c.id))
      .map((c) => ({ id: `youtube|${c.id}`, label: nombreCanal(c), hint: "Canal de YouTube" })),
  ];

  const vista = gruposConPrecio();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precio base por red</CardTitle>
        <div className="flex items-center gap-1.5">
          <span className="eyebrow">{currency}</span>
          {puedeEditar &&
            (editando ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                  {guardando && <LoaderCircle size={13} className="animate-spin" />}
                  Guardar
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={empezar}>
                {rates.length ? "Editar" : "Añadir"}
              </Button>
            ))}
        </div>
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {editando ? (
        <div className="space-y-3 border-t border-[var(--line)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {grupos.map((g) => (
              <section
                key={clave(g)}
                className="rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3"
              >
                <header className="mb-2 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{titulo(g)}</span>
                    {g.channelId && (
                      <span className="block text-[11.5px] text-[var(--text-subtle)]">Canal de YouTube</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarGrupo(g)}
                    aria-label={`Quitar ${titulo(g)}`}
                    title="Quitar sus precios"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-chip)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <X size={13} />
                  </button>
                </header>
                <div className="space-y-1.5">
                  {tareasDe(g).map((t) => (
                    <label key={t.type} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-muted)]">
                        {t.label}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={borrador[clave(g)]?.[t.type] ?? ""}
                        onChange={(e) => escribir(g, t.type, e.target.value)}
                        placeholder="—"
                        aria-label={`${titulo(g)}: ${t.label}`}
                        className="tabular h-8 w-28 text-right"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {faltan.length > 0 && (
            <div className="flex items-center gap-2">
              <Plus size={14} className="shrink-0 text-[var(--text-subtle)]" />
              <Picker
                value=""
                onChange={(id) => {
                  const [platform, channelId] = id.split("|") as [SocialPlatform, string];
                  anadirGrupo({ platform, channelId: channelId ?? TODA_LA_RED });
                }}
                options={faltan}
                placeholder="Añadir otra red o canal…"
                className="max-w-72"
              />
            </div>
          )}

          <FieldHint>
            Vacío o en cero, no hay precio para esa pieza. Sin tarifa propia, la campaña usa las
            tarifas mínimas de la ficha.
          </FieldHint>
        </div>
      ) : vista.length === 0 ? (
        <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
          Sin precios por red. La campaña usará las tarifas mínimas de la ficha.
        </p>
      ) : (
        <div className="grid gap-3 border-t border-[var(--line)] p-4 sm:grid-cols-2">
          {vista.map((g) => {
            const suyasDelGrupo = rates.filter(
              (r) => r.platform === g.platform && r.channelId === g.channelId,
            );
            return (
              <section
                key={clave(g)}
                className="rounded-[var(--r-control)] border border-[var(--line)] p-3"
              >
                <header className="mb-1.5">
                  <span className="block truncate text-[13px] font-semibold">{titulo(g)}</span>
                  {g.channelId && (
                    <span className="block text-[11.5px] text-[var(--text-subtle)]">Canal de YouTube</span>
                  )}
                </header>
                <dl className="space-y-1">
                  {tareasDe(g)
                    .filter((t) => suyasDelGrupo.some((r) => r.type === t.type))
                    .map((t) => {
                      const r = suyasDelGrupo.find((x) => x.type === t.type)!;
                      return (
                        <div key={t.type} className="flex items-baseline justify-between gap-3">
                          <dt className="truncate text-[12.5px] text-[var(--text-muted)]">{t.label}</dt>
                          <dd className="tabular shrink-0 text-[13px] font-semibold">
                            {formatMoney(r.amount, currency)}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
