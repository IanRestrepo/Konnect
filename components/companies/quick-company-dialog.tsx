"use client";

import { useState } from "react";
import { Building2, LoaderCircle, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { INDUSTRIES } from "@/lib/labels";
import type { Company, CompanyKind } from "@/lib/types";
import { CompanyKindField } from "@/components/companies/company-kind-field";

const ESTADOS = [
  { id: "prospecto", label: "Prospecto" },
  { id: "activo", label: "Activo" },
  { id: "inactivo", label: "Inactivo" },
] as const;

/**
 * Alta de cliente sin salir de donde estabas.
 *
 * El alta completa vive en Empresas y pide contactos, redes y notas. Esto pide
 * lo mínimo para que la campaña tenga a quién facturarle, por la misma razón
 * que la categoría del creador se crea desde su ficha: mandar a otra pantalla
 * a quien está a medio formulario es perder el formulario, y el resultado es
 * que la campaña acaba colgando del cliente equivocado.
 *
 * Lo demás se rellena después en la ficha de la empresa.
 */
export function QuickCompanyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (company: Company) => void;
}) {
  const [kind, setKind] = useState<CompanyKind>("empresa");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0] ?? "Otro");
  const [status, setStatus] = useState<Company["status"]>("activo");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setName("");
    setKind("empresa");
    setIndustry(INDUSTRIES[0] ?? "Otro");
    setStatus("activo");
    setError(null);
    onClose();
  }

  async function guardar() {
    const limpio = name.trim();
    if (!limpio) {
      setError(kind === "persona" ? "Falta el nombre." : "La empresa necesita un nombre.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: limpio, industry, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el cliente.");
      onCreated(data.company as Company);
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
      size="sm"
      icon={Building2}
      title="Nuevo cliente"
      description="Lo justo para poder facturarle. El resto se completa en su ficha."
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando || !name.trim()}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            Crear cliente
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        <CompanyKindField value={kind} onChange={setKind} />

        <div>
          <Label htmlFor="qc-name">{kind === "persona" ? "Nombre y apellido" : "Nombre de la empresa"}</Label>
          <Input
            id="qc-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                e.preventDefault();
                void guardar();
              }
            }}
            placeholder="Nova Labs"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="qc-industry">Sector</Label>
            <Picker
              id="qc-industry"
              value={industry}
              onChange={setIndustry}
              options={INDUSTRIES.map((i) => ({ id: i, label: i }))}
            />
          </div>
          <div>
            <Label htmlFor="qc-status">Estado</Label>
            <Picker
              id="qc-status"
              value={status}
              onChange={(v) => setStatus(v as Company["status"])}
              options={ESTADOS.map((e) => ({ id: e.id, label: e.label }))}
            />
          </div>
        </div>

        <FieldHint>Queda dado de alta en Empresas y elegido en la campaña.</FieldHint>
      </div>
    </Modal>
  );
}
