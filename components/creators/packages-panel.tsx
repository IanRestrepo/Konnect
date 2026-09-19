"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Package, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { useCan } from "@/components/session-provider";
import { PLATFORMS, PLATFORM_LABEL, TAREAS, piezaLabel } from "@/lib/socials";
import { IMPORTE_MAXIMO, rateFor } from "@/lib/pricing";
import type { Creator, CreatorPackage, PackageItem, SocialPlatform } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/** «3 videos dedicados + 2 Reels», lo que se lee de un vistazo. */
export function resumenPaquete(items: PackageItem[]): string {
  return items
    .map((i) => `${i.qty} × ${piezaLabel(i.platform, i.type, i.customType)} (${PLATFORM_LABEL[i.platform]})`)
    .join(" + ");
}

type CreadorTarifas = Pick<Creator, "rates" | "rateVideo" | "rateShort" | "rateIntegration" | "currency">;

/** Lo que costarían las piezas del paquete compradas sueltas, a su tarifa. */
function sueltas(creator: CreadorTarifas, items: PackageItem[]): number {
  return items.reduce((s, i) => s + rateFor(creator, i.platform, i.type) * i.qty, 0);
}

/**
 * Paquetes cerrados del creador: varias piezas por un precio, como «3 videos +
 * 5 historias». Es como se venden muchas colaboraciones, y sin esto había que
 * repartir el precio a mano entre las piezas cada vez que se contrataba.
 *
 * Al contratarlo en una campaña, el paquete se convierte en sus piezas y el
 * precio se reparte entre ellas.
 */
export function PackagesPanel({
  creatorId,
  creator,
  packages,
  suyas,
}: {
  creatorId: string;
  creator: CreadorTarifas;
  packages: CreatorPackage[];
  /** Sus redes, para proponerlas primero. */
  suyas: SocialPlatform[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");
  const [editando, setEditando] = useState<CreatorPackage | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quitar(p: CreatorPackage) {
    if (!window.confirm(`¿Quitar el paquete «${p.name}»? Las campañas que ya lo usaron no cambian.`)) return;
    setError(null);
    const res = await fetch(
      `/api/creadores/${creatorId}/paquetes?packageId=${encodeURIComponent(p.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo quitar el paquete.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paquetes</CardTitle>
        {puedeEditar && (
          <Button variant="secondary" size="sm" onClick={() => setEditando("nuevo")}>
            <Plus size={14} />
            Crear paquete
          </Button>
        )}
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {packages.length === 0 ? (
        <p className="border-t border-[var(--line)] px-5 py-4 text-[12.5px] text-[var(--text-muted)]">
          Sin paquetes. Crea uno si vende varias piezas juntas por un precio cerrado.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {packages.map((p) => {
            const piezas = p.items.reduce((s, i) => s + i.qty, 0);
            const aparte = sueltas(creator, p.items);
            return (
              <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                <Package size={16} className="mt-0.5 shrink-0 text-[var(--text-subtle)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium">{p.name}</span>
                    <span className="tabular shrink-0 text-[13.5px] font-semibold">
                      {formatMoney(p.price, creator.currency)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                    {resumenPaquete(p.items)}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-[var(--text-subtle)]">
                    {piezas} pieza{piezas === 1 ? "" : "s"}
                    {aparte > p.price &&
                      ` · sueltas saldrían en ${formatMoney(aparte, creator.currency)}`}
                  </span>
                </span>
                {puedeEditar && (
                  <span className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditando(p)}
                      aria-label={`Editar ${p.name}`}
                      className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => quitar(p)}
                      aria-label={`Quitar ${p.name}`}
                      className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <PaqueteDialog
          key={editando === "nuevo" ? "nuevo" : editando.id}
          creatorId={creatorId}
          creator={creator}
          inicial={editando === "nuevo" ? null : editando}
          suyas={suyas}
          onClose={() => setEditando(null)}
        />
      )}
    </Card>
  );
}

type Linea = {
  platform: SocialPlatform;
  type: PackageItem["type"];
  /** Nombre propio de la pieza, si lo traía; se conserva al editar. */
  customType: string | null;
  qty: string;
};

function PaqueteDialog({
  creatorId,
  creator,
  inicial,
  suyas,
  onClose,
}: {
  creatorId: string;
  creator: CreadorTarifas;
  inicial: CreatorPackage | null;
  suyas: SocialPlatform[];
  onClose: () => void;
}) {
  const router = useRouter();
  const principal = suyas[0] ?? "youtube";
  const [name, setName] = useState(inicial?.name ?? "");
  const [price, setPrice] = useState(inicial ? String(inicial.price) : "");
  const [notes, setNotes] = useState(inicial?.notes ?? "");
  const [lineas, setLineas] = useState<Linea[]>(
    inicial?.items.map((i) => ({
      platform: i.platform,
      type: i.type,
      customType: i.customType,
      qty: String(i.qty),
    })) ?? [{ platform: principal, type: TAREAS[principal][0]!.type, customType: null, qty: "1" }],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesRed = [
    ...suyas.map((p) => ({ id: p, label: PLATFORM_LABEL[p], hint: "Su red" })),
    ...PLATFORMS.filter((p) => !suyas.includes(p.id)).map((p) => ({ id: p.id, label: p.label })),
  ];

  const items: PackageItem[] = lineas
    .map((l) => ({
      platform: l.platform,
      type: l.type,
      customType: l.customType,
      qty: Math.floor(Number(l.qty)) || 0,
    }))
    .filter((i) => i.qty > 0);
  const aparte = sueltas(creator, items);
  const total = Number(price) || 0;

  function cambiar(i: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function guardar() {
    if (!name.trim()) return setError("Ponle un nombre al paquete.");
    if (items.length === 0) return setError("El paquete necesita al menos una pieza.");
    if (total <= 0) return setError("Falta el precio del paquete.");
    if (total > IMPORTE_MAXIMO) return setError("Ese precio es demasiado grande para guardarlo.");

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/paquetes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inicial?.id, name: name.trim(), price: total, items, notes: notes.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el paquete.");
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
      icon={Package}
      size="lg"
      title={inicial ? "Editar paquete" : "Crear paquete"}
      description="Varias piezas por un precio cerrado. Al contratarlo, el precio se reparte entre ellas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            Guardar paquete
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <div>
            <Label htmlFor="pq-nombre">Nombre</Label>
            <Input
              id="pq-nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Lanzamiento completo"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="pq-precio">Precio ({creator.currency})</Label>
            <Input
              id="pq-precio"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="tabular"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="mb-0">Qué incluye</Label>
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-[4.5rem_1fr_1fr_2.25rem] gap-2">
              <Input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => cambiar(i, { qty: e.target.value })}
                aria-label="Cuántas"
                className="tabular text-center"
              />
              <Picker
                value={l.platform}
                onChange={(platform) =>
                  cambiar(i, {
                    platform,
                    type: TAREAS[platform].some((t) => t.type === l.type) ? l.type : TAREAS[platform][0]!.type,
                    customType: null,
                  })
                }
                options={opcionesRed}
              />
              <Picker
                value={l.type}
                onChange={(type) => cambiar(i, { type, customType: null })}
                options={TAREAS[l.platform].map((t) => ({ id: t.type, label: t.label }))}
              />
              <button
                type="button"
                onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Quitar línea"
                disabled={lineas.length === 1}
                className="grid h-10 w-9 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-30"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setLineas((prev) => [
                ...prev,
                { platform: principal, type: TAREAS[principal][0]!.type, customType: null, qty: "1" },
              ])
            }
          >
            <Plus size={13} />
            Añadir pieza
          </Button>
        </div>

        {items.length > 0 && (
          <p className="rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] text-[var(--text-muted)]">
            {items.reduce((s, i) => s + i.qty, 0)} piezas
            {aparte > 0 && (
              <>
                {" · "}sueltas, a su tarifa, saldrían en{" "}
                <span className="tabular font-medium text-[var(--text)]">
                  {formatMoney(aparte, creator.currency)}
                </span>
                {total > 0 && aparte > total && (
                  <span className="text-[var(--ok)]">
                    {" "}
                    ({Math.round(((aparte - total) / aparte) * 100)}% menos en paquete)
                  </span>
                )}
              </>
            )}
          </p>
        )}

        <div>
          <Label htmlFor="pq-notas">Notas</Label>
          <Textarea
            id="pq-notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones: plazos, revisiones incluidas, derechos de uso…"
          />
          <FieldHint>Es lo que recibe el creador. Al cliente se le cobra con la comisión de la agencia.</FieldHint>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
