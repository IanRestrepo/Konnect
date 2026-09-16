"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, PenLine, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "@/components/notes/editor";
import { useCan } from "@/components/session-provider";
import type { Doc } from "@/lib/types";

/**
 * Los apuntes de la campaña, escritos ahí mismo y guardados en Notas.
 *
 * Eran un párrafo de solo lectura que se editaba desde el diálogo de la
 * campaña. Ahora son una nota de verdad —con su editor, imágenes y búsqueda—
 * que se escribe desde la propia campaña y aparece también en Notas, enlazada.
 * La nota se crea con el primer apunte, no antes: una campaña sin apuntes no
 * llena Notas de documentos vacíos.
 */
export function CampaignNotesCard({
  campaignId,
  doc: inicial,
  textoAnterior,
}: {
  campaignId: string;
  /** La nota de apuntes, si ya existe. */
  doc: Doc | null;
  /** Lo que había en el campo de texto de antes, mientras no hay nota. */
  textoAnterior: string;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_notas") && can("editar_campanas");

  const [doc, setDoc] = useState<Doc | null>(inicial);
  const [abriendo, setAbriendo] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "guardando" | "guardado">("quieto");
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Lo último escrito y aún sin mandar, con la nota a la que va. */
  const pendiente = useRef<{ docId: string; content: unknown; plainText: string } | null>(null);

  // Salir de la página con un cambio esperando su turno no lo pierde: se manda
  // en el acto. `keepalive` deja terminar la petición aunque la página se vaya.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      const p = pendiente.current;
      if (!p) return;
      void fetch(`/api/notas/${p.docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: p.content, plainText: p.plainText }),
        keepalive: true,
      });
    },
    [],
  );

  async function abrir() {
    setAbriendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/apuntes`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudieron abrir los apuntes.");
      setDoc(data as Doc);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setAbriendo(false);
    }
  }

  function cambiar(content: unknown, plainText: string) {
    if (!doc) return;
    setEstado("guardando");
    pendiente.current = { docId: doc.id, content, plainText };
    if (temporizador.current) clearTimeout(temporizador.current);
    // Se agrupan los cambios seguidos en una sola escritura, como en Notas.
    temporizador.current = setTimeout(async () => {
      pendiente.current = null;
      try {
        const res = await fetch(`/api/notas/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, plainText }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "No se pudieron guardar los apuntes.");
        }
        setEstado("guardado");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
        setEstado("quieto");
      }
    }, 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apuntes de la campaña</CardTitle>
        <span className="flex items-center gap-2">
          {estado !== "quieto" && (
            <span className="text-[12px] text-[var(--text-subtle)]">
              {estado === "guardando" ? "Guardando…" : "Guardado"}
            </span>
          )}
          {doc && (
            <Link
              href={`/notas/${doc.id}`}
              className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Abrir en Notas
              <ExternalLink size={12} />
            </Link>
          )}
        </span>
      </CardHeader>

      {error && (
        <p className="mx-5 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {doc ? (
        <div className="max-h-[420px] overflow-y-auto border-t border-[var(--line)] px-5 py-3">
          <NoteEditor content={doc.content} editable={puedeEditar} onChange={cambiar} />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <p className="text-[13px] leading-relaxed whitespace-pre-line text-[var(--text-muted)]">
            {textoAnterior || "Sin apuntes."}
          </p>
          {puedeEditar && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={abrir} disabled={abriendo}>
              {abriendo ? <LoaderCircle size={13} className="animate-spin" /> : <PenLine size={13} />}
              {textoAnterior ? "Editar apuntes" : "Escribir apuntes"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
