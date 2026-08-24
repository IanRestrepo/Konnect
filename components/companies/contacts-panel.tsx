"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Star, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

type Borrador = {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  primary: boolean;
  notes: string;
};

const VACIO: Borrador = {
  name: "",
  role: "",
  email: "",
  phone: "",
  primary: false,
  notes: "",
};

/** Todas las personas de contacto de una empresa. Una es la principal. */
export function ContactsPanel({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_empresas");

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Borrador[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezar() {
    setBorrador(
      contacts.length
        ? contacts.map((c) => ({ ...c }))
        : [{ ...VACIO, primary: true }],
    );
    setError(null);
    setEditando(true);
  }

  function cambiar(i: number, patch: Partial<Borrador>) {
    setBorrador((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function marcarPrincipal(i: number) {
    setBorrador((prev) => prev.map((c, j) => ({ ...c, primary: j === i })));
  }

  async function guardar() {
    const limpio = borrador.filter((c) => c.name.trim());
    if (limpio.length === 0) {
      setError("Deja al menos un contacto con nombre.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${companyId}/contactos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: limpio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron guardar los contactos.");
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
        <CardTitle>Contactos</CardTitle>
        {puedeEditar &&
          (editando ? (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando && <LoaderCircle size={13} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={empezar}>
              {contacts.length ? "Editar" : "Añadir"}
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
          {borrador.map((contacto, i) => (
            <div
              key={contacto.id ?? `nuevo-${i}`}
              className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] p-3"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => marcarPrincipal(i)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2 py-1 text-[11.5px] font-medium transition",
                    contacto.primary
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-subtle)] hover:bg-[var(--surface-3)]",
                  )}
                >
                  <Star
                    size={12}
                    className={contacto.primary ? "fill-current" : undefined}
                  />
                  {contacto.primary ? "Principal" : "Marcar principal"}
                </button>

                <button
                  type="button"
                  onClick={() => setBorrador((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Quitar contacto"
                  className="grid h-7 w-7 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`ct-name-${i}`}>Nombre</Label>
                  <Input
                    id={`ct-name-${i}`}
                    value={contacto.name}
                    onChange={(e) => cambiar(i, { name: e.target.value })}
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div>
                  <Label htmlFor={`ct-role-${i}`}>Cargo</Label>
                  <Input
                    id={`ct-role-${i}`}
                    value={contacto.role}
                    onChange={(e) => cambiar(i, { role: e.target.value })}
                    placeholder="Brand manager"
                  />
                </div>
                <div>
                  <Label htmlFor={`ct-mail-${i}`}>Correo</Label>
                  <Input
                    id={`ct-mail-${i}`}
                    type="email"
                    value={contacto.email}
                    onChange={(e) => cambiar(i, { email: e.target.value })}
                    placeholder="persona@empresa.com"
                  />
                </div>
                <div>
                  <Label htmlFor={`ct-tel-${i}`}>Teléfono</Label>
                  <Input
                    id={`ct-tel-${i}`}
                    value={contacto.phone}
                    onChange={(e) => cambiar(i, { phone: e.target.value })}
                    placeholder="+57 300 000 0000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`ct-notas-${i}`}>Nota</Label>
                  <Input
                    id={`ct-notas-${i}`}
                    value={contacto.notes}
                    onChange={(e) => cambiar(i, { notes: e.target.value })}
                    placeholder="Aprueba presupuestos, responde por WhatsApp…"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBorrador((prev) => [...prev, { ...VACIO }])}
          >
            <Plus size={14} />
            Añadir contacto
          </Button>
        </div>
      ) : contacts.length === 0 ? (
        <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
          Sin contactos registrados.
        </p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {contacts.map((contacto) => (
            <div key={contacto.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={contacto.name} size={32} muted={!contacto.primary} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {contacto.name}
                  {contacto.primary && (
                    <Star size={11} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" />
                  )}
                </p>
                <p className="truncate text-[11.5px] text-[var(--text-subtle)]">
                  {contacto.role || "Sin cargo"}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px]">
                  {contacto.email && (
                    <a
                      href={`mailto:${contacto.email}`}
                      className="text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      {contacto.email}
                    </a>
                  )}
                  {contacto.phone && (
                    <a
                      href={`tel:${contacto.phone.replace(/\s/g, "")}`}
                      className="tabular text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      {contacto.phone}
                    </a>
                  )}
                </div>
                {contacto.notes && (
                  <p className="mt-1 text-[11.5px] text-[var(--text-subtle)]">{contacto.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
