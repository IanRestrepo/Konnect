"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { Badge } from "@/components/ui/badge";
import { useCan } from "@/components/session-provider";
import { PLATFORMS, PLATFORM_LABEL, TAREAS, tareaLabel } from "@/lib/socials";
import { IMPORTE_MAXIMO } from "@/lib/pricing";
import type { Creator, CreatorRate, DeliverableType, SocialPlatform } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

type Fila = { platform: SocialPlatform; type: DeliverableType; amount: string };

/** Primera tarea que ofrece esa red: lo que se propone al añadir una fila. */
function primeraTarea(platform: SocialPlatform): DeliverableType {
  return TAREAS[platform][0]?.type ?? "video";
}

/**
 * Precio base del creador por red y tipo de pieza.
 *
 * Es lo que el creador quiere recibir, no lo que se le cobra al cliente: al
 * armar una campaña sale como precio de partida y de ahí se calcula el cobro
 * con la comisión de la agencia.
 *
 * Las redes que el creador tiene registradas van primero, porque son las que
 * de verdad se le van a encargar; el resto siguen disponibles por si se pacta
 * algo suelto.
 */
export function RatesPanel({
  creatorId,
  rates,
  currency,
  socials,
  mainPlatform,
}: {
  creatorId: string;
  rates: CreatorRate[];
  currency: Creator["currency"];
  socials: SocialPlatform[];
  mainPlatform: SocialPlatform;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Fila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las suyas primero, sin repetir, y detrás todas las demás.
  const suyas = [...new Set([mainPlatform, ...socials])];
  const opcionesRed = [
    ...suyas.map((p) => ({ id: p, label: PLATFORM_LABEL[p], hint: "Su red" })),
    ...PLATFORMS.filter((p) => !suyas.includes(p.id)).map((p) => ({ id: p.id, label: p.label })),
  ];

  function empezar() {
    setBorrador(
      rates.length
        ? rates.map((r) => ({ platform: r.platform, type: r.type, amount: String(r.amount) }))
        : [{ platform: mainPlatform, type: primeraTarea(mainPlatform), amount: "" }],
    );
    setError(null);
    setEditando(true);
  }

  function cambiar(i: number, patch: Partial<Fila>) {
    setBorrador((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  async function guardar() {
    const limpio = borrador
      .map((f) => ({ platform: f.platform, type: f.type, amount: Number(f.amount) || 0 }))
      .filter((f) => f.amount > 0);

    if (limpio.some((f) => f.amount > IMPORTE_MAXIMO)) {
      setError("Alguna tarifa es demasiado grande para guardarla.");
      return;
    }
    // La base tiene una tarifa por red y tipo: dos filas iguales se pisarían.
    const llaves = limpio.map((f) => `${f.platform}-${f.type}`);
    if (new Set(llaves).size !== llaves.length) {
      setError("Hay dos tarifas para la misma red y el mismo tipo de pieza.");
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

  return (
    // El desplegable propio se sale de la tarjeta; sin esto lo cortaría.
    <Card style={editando ? { overflow: "visible" } : undefined}>
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
        <div className="space-y-2 border-t border-[var(--line)] p-4">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_1fr_7rem_2.5rem]">
            <Label className="mb-0">Red</Label>
            <Label className="mb-0">Pieza</Label>
            <Label className="mb-0">Precio</Label>
            <span />
          </div>

          {borrador.map((fila, i) => (
            <div
              key={`${fila.platform}-${fila.type}-${i}`}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_2.5rem]"
            >
              <Picker
                value={fila.platform}
                onChange={(platform) =>
                  cambiar(i, {
                    platform,
                    // Cambiar de red puede dejar la pieza sin sentido: un
                    // «Short» no existe en Twitch. Se cae en la primera suya.
                    type: TAREAS[platform].some((t) => t.type === fila.type)
                      ? fila.type
                      : primeraTarea(platform),
                  })
                }
                options={opcionesRed}
              />

              <Picker
                value={fila.type}
                onChange={(type) => cambiar(i, { type })}
                options={TAREAS[fila.platform].map((t) => ({ id: t.type, label: t.label }))}
              />

              <Input
                type="number"
                min={0}
                value={fila.amount}
                onChange={(e) => cambiar(i, { amount: e.target.value })}
                placeholder="0"
                aria-label="Precio"
                className="tabular"
              />

              <button
                type="button"
                onClick={() => setBorrador((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Quitar tarifa"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setBorrador((prev) => [
                ...prev,
                {
                  platform: mainPlatform,
                  type: primeraTarea(mainPlatform),
                  amount: "",
                },
              ])
            }
          >
            <Plus size={14} />
            Añadir tarifa
          </Button>

          <FieldHint>
            En cero se borra. Sin tarifa propia, la campaña usa las tarifas mínimas de la ficha.
          </FieldHint>
        </div>
      ) : rates.length === 0 ? (
        <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
          Sin precios por red. La campaña usará las tarifas mínimas de la ficha.
        </p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {rates.map((rate) => (
            <div key={rate.id} className="flex items-center gap-3 px-4 py-2.5">
              <Badge plain>{PLATFORM_LABEL[rate.platform]}</Badge>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
                {tareaLabel(rate.platform, rate.type)}
              </span>
              <span className="tabular shrink-0 text-[13px] font-semibold">
                {formatMoney(rate.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
