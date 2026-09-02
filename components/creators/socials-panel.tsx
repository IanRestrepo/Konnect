"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { useCan } from "@/components/session-provider";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/socials";
import type { SocialLink, SocialPlatform } from "@/lib/types";

type Borrador = { id?: string; platform: SocialPlatform; handle: string };

/** Perfiles del creador fuera de YouTube. Se guardan todos de una vez. */
export function SocialsPanel({
  creatorId,
  socials,
}: {
  creatorId: string;
  socials: SocialLink[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Borrador[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezar() {
    // Sin redes, se abre con una fila lista: pulsar «Añadir» y encontrarse un
    // panel vacío obligaba a pulsar otra vez para escribir algo.
    setBorrador(
      socials.length
        ? socials.map((s) => ({ id: s.id, platform: s.platform, handle: s.handle }))
        : [{ platform: "instagram", handle: "" }],
    );
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const limpio = borrador.filter((s) => s.handle.trim());
      const res = await fetch(`/api/creadores/${creatorId}/redes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socials: limpio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron guardar las redes.");
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    // La tarjeta recorta lo que se sale de ella, y la lista del desplegable se
    // sale por abajo. Mientras se edita se deja asomar; el resto del tiempo
    // vuelve a recortar, que es lo que mantiene el radio limpio.
    <Card style={editando ? { overflow: "visible" } : undefined}>
      <CardHeader>
        <CardTitle>Redes sociales</CardTitle>
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
              {socials.length ? "Editar" : "Añadir"}
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
        <div className="space-y-2 border-t border-[var(--line)] p-4">
          {borrador.map((fila, i) => (
            <div key={fila.id ?? `nueva-${i}`} className="flex gap-2">
              <Picker
                value={fila.platform}
                onChange={(platform) =>
                  setBorrador((prev) => prev.map((f, j) => (j === i ? { ...f, platform } : f)))
                }
                options={PLATFORMS.map((p) => ({ id: p.id, label: p.label }))}
                className="w-32 shrink-0"
              />

              {/* `min-w-0` es lo que impide que el ancho natural del campo
                  empuje la fila fuera de la tarjeta en la columna estrecha. */}
              <Input
                value={fila.handle}
                onChange={(e) =>
                  setBorrador((prev) =>
                    prev.map((f, j) => (j === i ? { ...f, handle: e.target.value } : f)),
                  )
                }
                placeholder={PLATFORMS.find((p) => p.id === fila.platform)?.placeholder}
                aria-label="Usuario"
                className="min-w-0 flex-1"
              />

              <button
                onClick={() => setBorrador((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Quitar red"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBorrador((prev) => [...prev, { platform: "instagram", handle: "" }])}
          >
            <Plus size={14} />
            Añadir red
          </Button>
        </div>
      ) : socials.length === 0 ? (
        <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-muted)]">
          Sin redes registradas.
        </p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {socials.map((red) => (
            <div key={red.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-24 shrink-0 text-[12.5px] text-[var(--text-muted)]">
                {PLATFORM_LABEL[red.platform]}
              </span>
              <Link
                href={red.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-[var(--accent)]"
              >
                {red.handle}
              </Link>
              <ExternalLink size={13} className="shrink-0 text-[var(--text-subtle)]" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
