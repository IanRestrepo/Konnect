"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { CATEGORIES, CURRENCIES, PAYMENT_METHOD } from "@/lib/labels";
import type { Creator, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const METODOS = Object.keys(PAYMENT_METHOD) as PaymentMethod[];

/** Los datos bancarios no se tocan aquí: se editan tras revelarlos. */
type Campos = {
  name: string;
  handle: string;
  country: string;
  category: string;
  status: Creator["status"];
  email: string;
  phone: string;
  currency: string;
  rateVideo: string;
  rateShort: string;
  rateIntegration: string;
  notes: string;
};

function desde(creator: Creator): Campos {
  return {
    name: creator.name,
    handle: creator.handle,
    country: creator.country,
    category: creator.category,
    status: creator.status,
    email: creator.email,
    phone: creator.phone,
    currency: creator.currency,
    rateVideo: String(creator.rateVideo),
    rateShort: String(creator.rateShort),
    rateIntegration: String(creator.rateIntegration),
    notes: creator.notes,
  };
}

/** Botón de la cabecera de la ficha, con su formulario de edición. */
export function EditCreatorButton({ creator }: { creator: Creator }) {
  const router = useRouter();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Campos>(() => desde(creator));
  const [methods, setMethods] = useState<PaymentMethod[]>(creator.paymentMethods);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("editar_creadores")) return null;

  function set<K extends keyof Campos>(key: K, value: Campos[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function abrir() {
    // Siempre se parte de lo que hay guardado, no de un borrador anterior.
    setForm(desde(creator));
    setMethods(creator.paymentMethods);
    setError(null);
    setOpen(true);
  }

  function alternarMetodo(m: PaymentMethod) {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function guardar() {
    if (!form.name.trim()) {
      setError("Falta el nombre.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          handle: form.handle.trim(),
          country: form.country.trim(),
          category: form.category,
          status: form.status,
          email: form.email.trim(),
          phone: form.phone.trim(),
          currency: form.currency,
          rateVideo: Number(form.rateVideo) || 0,
          rateShort: Number(form.rateShort) || 0,
          rateIntegration: Number(form.rateIntegration) || 0,
          paymentMethods: methods,
          notes: form.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el creador.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button variant="primary" size="lg" onClick={abrir}>
        Editar
        <Pencil size={15} />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar creador"
        description="Los datos del canal se actualizan desde YouTube, no aquí."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardar} disabled={guardando}>
              {guardando && <LoaderCircle size={14} className="animate-spin" />}
              Guardar cambios
            </Button>
          </>
        }
      >
        {error && (
          <p className="mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ec-name">Nombre</Label>
            <Input
              id="ec-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nombre del creador"
            />
          </div>

          <div>
            <Label htmlFor="ec-handle">Handle</Label>
            <Input
              id="ec-handle"
              value={form.handle}
              onChange={(e) => set("handle", e.target.value)}
              placeholder="@usuario"
            />
          </div>

          <div>
            <Label htmlFor="ec-category">Categoría</Label>
            <Select
              id="ec-category"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {/* Una categoría vieja que ya no esté en la lista no debe perderse. */}
              {(CATEGORIES.includes(form.category)
                ? CATEGORIES
                : [form.category, ...CATEGORIES]
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="ec-status">Estado</Label>
            <Select
              id="ec-status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as Creator["status"])}
            >
              <option value="activo">Activo</option>
              <option value="pausado">En pausa</option>
              <option value="prospecto">Prospecto</option>
              <option value="archivado">Archivado</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="ec-country">País</Label>
            <Input
              id="ec-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="Colombia"
            />
          </div>

          <div>
            <Label htmlFor="ec-currency">Moneda</Label>
            <Select
              id="ec-currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="ec-email">Correo</Label>
            <Input
              id="ec-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contacto@correo.com"
            />
          </div>

          <div>
            <Label htmlFor="ec-phone">Teléfono</Label>
            <Input
              id="ec-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+57 300 000 0000"
            />
          </div>

          <div>
            <Label htmlFor="ec-rate-video">Video dedicado</Label>
            <Input
              id="ec-rate-video"
              type="number"
              min={0}
              value={form.rateVideo}
              onChange={(e) => set("rateVideo", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ec-rate-short">Reel / Short</Label>
            <Input
              id="ec-rate-short"
              type="number"
              min={0}
              value={form.rateShort}
              onChange={(e) => set("rateShort", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ec-rate-integration">Fracción publicitaria</Label>
            <Input
              id="ec-rate-integration"
              type="number"
              min={0}
              value={form.rateIntegration}
              onChange={(e) => set("rateIntegration", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3">
          <Label>Métodos de pago</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {METODOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => alternarMetodo(m)}
                aria-pressed={methods.includes(m)}
                className={cn(
                  "rounded-[var(--r-control)] border px-2.5 py-1.5 text-[12.5px] transition",
                  methods.includes(m)
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--text-subtle)]",
                )}
              >
                {PAYMENT_METHOD[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="ec-notes">Notas internas</Label>
          <Textarea
            id="ec-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Contexto que le sirva al equipo."
          />
        </div>
      </Modal>
    </>
  );
}
