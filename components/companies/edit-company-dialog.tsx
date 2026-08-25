"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import { INDUSTRIES } from "@/lib/labels";
import type { Company } from "@/lib/types";

/** Los contactos tienen su propio panel; aquí va la ficha de la empresa. */
type Campos = {
  name: string;
  industry: string;
  website: string;
  status: Company["status"];
  notes: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
};

function desde(company: Company): Campos {
  return {
    name: company.name,
    industry: company.industry,
    website: company.website ?? "",
    status: company.status,
    notes: company.notes,
    instagram: company.socials.instagram ?? "",
    tiktok: company.socials.tiktok ?? "",
    youtube: company.socials.youtube ?? "",
    linkedin: company.socials.linkedin ?? "",
  };
}

export function EditCompanyButton({ company }: { company: Company }) {
  const router = useRouter();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Campos>(() => desde(company));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("editar_empresas")) return null;

  function set<K extends keyof Campos>(key: K, value: Campos[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function abrir() {
    setForm(desde(company));
    setError(null);
    setOpen(true);
  }

  async function guardar() {
    if (!form.name.trim()) {
      setError("Falta el nombre de la empresa.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry,
          website: form.website.trim() || null,
          status: form.status,
          notes: form.notes,
          socials: {
            instagram: form.instagram.trim() || undefined,
            tiktok: form.tiktok.trim() || undefined,
            youtube: form.youtube.trim() || undefined,
            linkedin: form.linkedin.trim() || undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la empresa.");
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
        title="Editar empresa"
        description="Las personas de contacto se gestionan en su propio panel."
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
            <Label htmlFor="ee-name">Nombre</Label>
            <Input
              id="ee-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nombre de la empresa"
            />
          </div>

          <div>
            <Label htmlFor="ee-industry">Sector</Label>
            <Select
              id="ee-industry"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
            >
              {/* Un sector viejo fuera de la lista tampoco debe perderse. */}
              {(INDUSTRIES.includes(form.industry)
                ? INDUSTRIES
                : [form.industry, ...INDUSTRIES]
              ).map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="ee-website">Sitio web</Label>
            <Input
              id="ee-website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://empresa.com"
            />
          </div>

          <div>
            <Label htmlFor="ee-status">Estado</Label>
            <Select
              id="ee-status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as Company["status"])}
            >
              <option value="activo">Activo</option>
              <option value="prospecto">Prospecto</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Redes de la marca</Label>
          <FieldHint>Opcionales. Se muestran como etiquetas en la ficha.</FieldHint>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            <Input
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="Instagram"
              aria-label="Instagram"
            />
            <Input
              value={form.tiktok}
              onChange={(e) => set("tiktok", e.target.value)}
              placeholder="TikTok"
              aria-label="TikTok"
            />
            <Input
              value={form.youtube}
              onChange={(e) => set("youtube", e.target.value)}
              placeholder="YouTube"
              aria-label="YouTube"
            />
            <Input
              value={form.linkedin}
              onChange={(e) => set("linkedin", e.target.value)}
              placeholder="LinkedIn"
              aria-label="LinkedIn"
            />
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="ee-notes">Notas internas</Label>
          <Textarea
            id="ee-notes"
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
