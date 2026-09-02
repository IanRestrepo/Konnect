"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DefList, DefRow } from "@/components/ui/def-list";
import { useCan } from "@/components/session-provider";
import { ContactFieldsEditor } from "@/components/creators/contact-fields-editor";
import type { ContactField } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** Un valor que se puede pulsar: correo, teléfono o enlace. */
function valorContacto(value: string) {
  if (/^https?:\/\//i.test(value)) return { href: value, texto: value };
  if (value.includes("@") && value.includes(".")) return { href: `mailto:${value}`, texto: value };
  if (/^\+?[\d\s().-]{7,}$/.test(value)) {
    return { href: `tel:${value.replace(/\s/g, "")}`, texto: value };
  }
  return { href: null, texto: value };
}

/**
 * Contacto del creador: los campos fijos de la ficha y los que le añade el
 * equipo —Discord, Telegram, el correo del mánager—, que cambian según por
 * dónde se le hable a cada uno.
 */
export function ContactCard({
  creatorId,
  email,
  phone,
  createdAt,
  fields,
}: {
  creatorId: string;
  email: string;
  phone: string;
  createdAt: string;
  fields: ContactField[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<ContactField[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezar() {
    setBorrador(fields.map((f) => ({ ...f })));
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/campos-contacto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: borrador
            .filter((f) => f.label.trim())
            .map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
        }),
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
        <CardTitle>Contacto</CardTitle>
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
              {fields.length ? "Editar" : "Añadir campo"}
            </Button>
          ))}
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <DefList className="border-t border-[var(--line)]">
        <DefRow label="Correo">
          {email ? (
            <a href={`mailto:${email}`} className="hover:text-[var(--accent)]">
              {email}
            </a>
          ) : (
            "—"
          )}
        </DefRow>
        <DefRow label="Teléfono">
          {phone ? (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="tabular hover:text-[var(--accent)]">
              {phone}
            </a>
          ) : (
            "—"
          )}
        </DefRow>

        {!editando &&
          fields.map((campo) => {
            const { href, texto } = valorContacto(campo.value);
            return (
              <DefRow key={campo.id} label={campo.label}>
                {href ? (
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className="hover:text-[var(--accent)]"
                  >
                    {texto}
                  </a>
                ) : (
                  texto || "—"
                )}
              </DefRow>
            );
          })}

        <DefRow label="En cartera desde">{formatDate(createdAt)}</DefRow>
      </DefList>

      {editando && (
        <div className="border-t border-[var(--line)] p-4">
          <ContactFieldsEditor fields={borrador} onChange={setBorrador} />
        </div>
      )}
    </Card>
  );
}
