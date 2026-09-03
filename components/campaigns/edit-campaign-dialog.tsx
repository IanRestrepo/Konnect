"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { CAMPAIGN_OBJECTIVE, CURRENCIES } from "@/lib/labels";
import type { Campaign, CampaignObjective } from "@/lib/types";

const OBJETIVOS = Object.keys(CAMPAIGN_OBJECTIVE) as CampaignObjective[];

/** `yyyy-mm-dd` para los campos de fecha; cadena vacía si no hay valor. */
function aInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

type Campos = {
  name: string;
  objective: CampaignObjective;
  status: Campaign["status"];
  currency: string;
  budget: string;
  startDate: string;
  endDate: string;
  notes: string;
};

function desde(campaign: Campaign): Campos {
  return {
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    currency: campaign.currency,
    budget: String(campaign.budget),
    startDate: aInput(campaign.startDate),
    endDate: aInput(campaign.endDate),
    notes: campaign.notes,
  };
}

/** Los entregables tienen su propia sección; aquí va la ficha de la campaña. */
export function EditCampaignButton({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Campos>(() => desde(campaign));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("editar_campanas")) return null;

  function set<K extends keyof Campos>(key: K, value: Campos[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function abrir() {
    setForm(desde(campaign));
    setError(null);
    setOpen(true);
  }

  async function guardar() {
    if (!form.name.trim()) {
      setError("Falta el nombre de la campaña.");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("La fecha de cierre no puede ser anterior al inicio.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      // Las fechas solo se mandan si cambiaron: un campo de día no debe
      // reescribir la hora que ya tenía guardada la campaña.
      const original = desde(campaign);
      const fechas: { startDate?: string; endDate?: string | null } = {};
      if (form.startDate && form.startDate !== original.startDate) {
        fechas.startDate = new Date(`${form.startDate}T00:00:00`).toISOString();
      }
      if (form.endDate !== original.endDate) {
        fechas.endDate = form.endDate ? new Date(`${form.endDate}T00:00:00`).toISOString() : null;
      }

      const res = await fetch(`/api/campanas/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          objective: form.objective,
          status: form.status,
          currency: form.currency,
          budget: Number(form.budget) || 0,
          ...fechas,
          notes: form.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la campaña.");
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
        Editar campaña
        <Pencil size={15} />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar campaña"
        description="Los entregables se gestionan más abajo, en su propia sección."
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
          <div className="sm:col-span-2">
            <Label htmlFor="ecp-name">Nombre</Label>
            <Input
              id="ecp-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nombre de la campaña"
            />
          </div>

          <div>
            <Label htmlFor="ecp-objective">Objetivo</Label>
            <Select
              id="ecp-objective"
              value={form.objective}
              onChange={(e) => set("objective", e.target.value as CampaignObjective)}
            >
              {OBJETIVOS.map((o) => (
                <option key={o} value={o}>
                  {CAMPAIGN_OBJECTIVE[o]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="ecp-status">Estado</Label>
            <Select
              id="ecp-status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as Campaign["status"])}
            >
              <option value="borrador">Borrador</option>
              <option value="activa">Activa</option>
              <option value="pausada">Pausada</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="ecp-currency">Moneda</Label>
            <Select
              id="ecp-currency"
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
            <Label htmlFor="ecp-budget">Presupuesto</Label>
            <Input
              id="ecp-budget"
              type="number"
              min={0}
              value={form.budget}
              onChange={(e) => set("budget", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ecp-start">Inicio</Label>
            <Input
              id="ecp-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ecp-end">Cierre</Label>
            <Input
              id="ecp-end"
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
            <FieldHint>Déjalo vacío si sigue abierta.</FieldHint>
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="ecp-notes">Notas internas</Label>
          <Textarea
            id="ecp-notes"
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
