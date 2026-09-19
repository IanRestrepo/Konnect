"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building, LoaderCircle, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DefList, DefRow } from "@/components/ui/def-list";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/components/session-provider";
import type { CreatorAgency } from "@/lib/types";

const VACIA: CreatorAgency = {
  name: "",
  exclusive: true,
  contactName: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
};

/**
 * La agencia externa que representa al creador, si la hay.
 *
 * Cuando un creador es exclusivo de otra agencia, no se negocia ni se le paga
 * a él: se habla con la agencia y el dinero va a sus cuentas. Aquí queda con
 * quién hablar; sus cuentas de cobro se marcan en «Pagos y datos privados».
 */
export function AgencyCard({
  creatorId,
  agency,
}: {
  creatorId: string;
  agency: CreatorAgency | null;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<CreatorAgency>(VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezar() {
    setBorrador(agency ?? VACIA);
    setError(null);
    setEditando(true);
  }

  function set<K extends keyof CreatorAgency>(k: K, v: CreatorAgency[K]) {
    setBorrador((prev) => ({ ...prev, [k]: v }));
  }

  async function enviar(init: RequestInit) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/agencia`, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la agencia.");
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agencia</CardTitle>
        {puedeEditar &&
          (editando ? (
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={guardando}
                onClick={() =>
                  enviar({
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(borrador),
                  })
                }
              >
                {guardando && <LoaderCircle size={13} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={empezar}>
              {agency ? "Editar" : "Añadir agencia"}
            </Button>
          ))}
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {editando ? (
        <div className="space-y-3 border-t border-[var(--line)] p-4">
          <div>
            <Label htmlFor="ag-nombre">Nombre de la agencia</Label>
            <Input
              id="ag-nombre"
              value={borrador.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej.: Talent House"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium">Exclusivo de esta agencia</span>
              <span className="block text-[12px] text-[var(--text-muted)]">
                Solo se le contrata a través de ella.
              </span>
            </span>
            <Switch
              checked={borrador.exclusive}
              onChange={(v) => set("exclusive", v)}
              label="Exclusivo de esta agencia"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ag-contacto">Persona de contacto</Label>
              <Input
                id="ag-contacto"
                value={borrador.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                placeholder="Con quién se negocia"
              />
            </div>
            <div>
              <Label htmlFor="ag-correo">Correo</Label>
              <Input
                id="ag-correo"
                type="email"
                value={borrador.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="talento@agencia.com"
              />
            </div>
            <div>
              <Label htmlFor="ag-tel">Teléfono / WhatsApp</Label>
              <Input
                id="ag-tel"
                value={borrador.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+52 55 0000 0000"
              />
            </div>
            <div>
              <Label htmlFor="ag-web">Web</Label>
              <Input
                id="ag-web"
                value={borrador.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="agencia.com"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ag-notas">Notas</Label>
            <Textarea
              id="ag-notas"
              value={borrador.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Comisión que se lleva, condiciones, a quién mandar las facturas…"
            />
          </div>
          <FieldHint>
            Sus cuentas de cobro se añaden en «Pagos y datos privados», marcando «Es de la agencia».
          </FieldHint>
          {agency && (
            <Button
              variant="ghost"
              size="sm"
              disabled={guardando}
              className="text-[var(--danger)]"
              onClick={() => {
                if (!window.confirm(`¿Quitar a ${agency.name} como agencia de este creador?`))
                  return;
                void enviar({ method: "DELETE" });
              }}
            >
              Ya no tiene agencia
            </Button>
          )}
        </div>
      ) : agency ? (
        <>
          <DefList className="border-t border-[var(--line)]">
            <DefRow label="Agencia">
              <span className="flex items-center gap-2">
                <span className="font-medium">{agency.name}</span>
                {agency.exclusive && <Badge tone="info">Exclusivo</Badge>}
              </span>
            </DefRow>
            {agency.contactName && <DefRow label="Contacto">{agency.contactName}</DefRow>}
            {agency.email && (
              <DefRow label="Correo">
                <a href={`mailto:${agency.email}`} className="hover:text-[var(--accent)]">
                  {agency.email}
                </a>
              </DefRow>
            )}
            {agency.phone && (
              <DefRow label="Teléfono">
                <a
                  href={`tel:${agency.phone.replace(/\s/g, "")}`}
                  className="tabular hover:text-[var(--accent)]"
                >
                  {agency.phone}
                </a>
              </DefRow>
            )}
            {agency.website && (
              <DefRow label="Web">
                <a
                  href={
                    /^https?:\/\//i.test(agency.website)
                      ? agency.website
                      : `https://${agency.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--accent)]"
                >
                  {agency.website.replace(/^https?:\/\//i, "")}
                </a>
              </DefRow>
            )}
          </DefList>
          {agency.notes && (
            <p className="border-t border-[var(--line)] px-5 py-3 text-[12.5px] leading-relaxed whitespace-pre-line text-[var(--text-muted)]">
              {agency.notes}
            </p>
          )}
        </>
      ) : (
        <p className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-4 text-[12.5px] text-[var(--text-muted)]">
          <Building size={15} className="shrink-0 text-[var(--text-subtle)]" />
          Se lleva directamente, sin agencia de por medio.
        </p>
      )}
    </Card>
  );
}
