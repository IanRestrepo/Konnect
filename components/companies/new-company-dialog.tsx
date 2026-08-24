"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";

const INDUSTRIES = [
  "Software B2B",
  "Consumo masivo",
  "Fintech",
  "Belleza",
  "Moda",
  "Gaming",
  "Educación",
  "Salud",
  "Automotriz",
  "Otro",
];

const EMPTY = {
  name: "",
  industry: INDUSTRIES[0],
  website: "",
  status: "prospecto",
  contactName: "",
  contactRole: "",
  email: "",
  phone: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  linkedin: "",
  notes: "",
};

export function NewCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    setForm({ ...EMPTY });
    setError(null);
    setSaving(false);
    onClose();
  }

  async function save() {
    if (!form.name.trim()) {
      setError("La empresa necesita un nombre.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry,
          website: form.website.trim() || null,
          status: form.status,
          contactName: form.contactName.trim(),
          contactRole: form.contactRole.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          socials: {
            instagram: form.instagram.trim() || undefined,
            tiktok: form.tiktok.trim() || undefined,
            youtube: form.youtube.trim() || undefined,
            linkedin: form.linkedin.trim() || undefined,
          },
          notes: form.notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      router.refresh();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Añadir empresa"
      description="Datos del cliente que contrata las campañas."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            Guardar empresa
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="company-name">Nombre de la empresa</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nova Labs"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="company-industry">Sector</Label>
            <Select
              id="company-industry"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
            >
              {INDUSTRIES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="company-website">Página web</Label>
            <Input
              id="company-website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://empresa.com"
            />
            <FieldHint>Opcional si solo tienen redes sociales.</FieldHint>
          </div>
          <div>
            <Label htmlFor="company-status">Estado</Label>
            <Select
              id="company-status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="activo">Activo</option>
              <option value="prospecto">Prospecto</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Contacto principal</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              placeholder="Nombre y apellido"
            />
            <Input
              value={form.contactRole}
              onChange={(e) => set("contactRole", e.target.value)}
              placeholder="Cargo"
            />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="correo@empresa.com"
            />
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+52 55 0000 0000"
            />
          </div>
        </div>

        <div>
          <Label>Redes sociales</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="Instagram (@marca)"
            />
            <Input
              value={form.tiktok}
              onChange={(e) => set("tiktok", e.target.value)}
              placeholder="TikTok (@marca)"
            />
            <Input
              value={form.youtube}
              onChange={(e) => set("youtube", e.target.value)}
              placeholder="YouTube (@marca)"
            />
            <Input
              value={form.linkedin}
              onChange={(e) => set("linkedin", e.target.value)}
              placeholder="LinkedIn (company/marca)"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="company-notes">Notas internas</Label>
          <Textarea
            id="company-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Condiciones de pago, contactos alternos, historial…"
          />
        </div>
      </div>
    </Modal>
  );
}
