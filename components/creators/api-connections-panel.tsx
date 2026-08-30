"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { useCan } from "@/components/session-provider";
import type { CreatorApiConnection, SocialPlatform } from "@/lib/types";

/** Plataformas que se muestran y si su conexión ya funciona. */
const FILAS: { platform: SocialPlatform; label: string; activa: boolean; placeholder: string }[] = [
  {
    platform: "youtube",
    label: "YouTube",
    activa: true,
    placeholder: "Clave de la YouTube Data / Analytics API",
  },
  { platform: "instagram", label: "Instagram", activa: false, placeholder: "" },
  { platform: "tiktok", label: "TikTok", activa: false, placeholder: "" },
];

/**
 * Claves de API para leer la analítica propia del creador. Solo YouTube está
 * operativo; Instagram y TikTok se listan como "en desarrollo".
 *
 * El secreto se manda al servidor, se cifra allí y nunca vuelve: de una conexión
 * ya guardada solo se ven los últimos 4 caracteres.
 */
export function ApiConnectionsPanel({
  creatorId,
  connections,
}: {
  creatorId: string;
  connections: CreatorApiConnection[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [abierta, setAbierta] = useState<SocialPlatform | null>(null);
  const [clave, setClave] = useState("");
  const [ocupada, setOcupada] = useState<SocialPlatform | null>(null);
  const [error, setError] = useState<string | null>(null);

  const porPlataforma = new Map(connections.map((c) => [c.platform, c]));

  function empezar(platform: SocialPlatform) {
    setAbierta(platform);
    setClave("");
    setError(null);
  }

  async function guardar(platform: SocialPlatform) {
    setOcupada(platform);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/conexiones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, apiKey: clave.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la clave.");
      setAbierta(null);
      setClave("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupada(null);
    }
  }

  async function quitar(platform: SocialPlatform) {
    if (!confirm("¿Quitar esta conexión? Dejará de sincronizarse la analítica.")) return;
    setOcupada(platform);
    setError(null);
    try {
      const res = await fetch(
        `/api/creadores/${creatorId}/conexiones?platform=${platform}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo quitar la conexión.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupada(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexiones de API</CardTitle>
        <span className="eyebrow">Analítica propia</span>
      </CardHeader>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
        {FILAS.map((fila) => {
          const conn = porPlataforma.get(fila.platform);
          const trabajando = ocupada === fila.platform;

          return (
            <div key={fila.platform} className="px-4 py-3">
              <div className="flex min-h-8 items-center gap-3">
                <span
                  className={
                    "w-24 shrink-0 text-[12.5px] " +
                    (fila.activa ? "text-[var(--text-muted)]" : "text-[var(--text-subtle)]")
                  }
                >
                  {fila.label}
                </span>

                {!fila.activa ? (
                  <span className="flex-1">
                    <Badge plain>En desarrollo</Badge>
                  </span>
                ) : conn ? (
                  <>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Badge tone="ok">Conectada</Badge>
                      <span className="tabular truncate text-[12.5px] text-[var(--text-subtle)]">
                        {conn.hint ? `•••• ${conn.hint}` : "clave guardada"}
                      </span>
                    </span>
                    {puedeEditar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => quitar(fila.platform)}
                        disabled={trabajando}
                      >
                        {trabajando && <LoaderCircle size={13} className="animate-spin" />}
                        Quitar
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="text-[12.5px] text-[var(--text-subtle)]">Sin conectar</span>
                    {puedeEditar && abierta !== fila.platform && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => empezar(fila.platform)}
                      >
                        Conectar
                      </Button>
                    )}
                  </span>
                )}
              </div>

              {fila.activa && abierta === fila.platform && (
                <div className="mt-2.5 flex gap-2">
                  <Input
                    type="password"
                    autoFocus
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder={fila.placeholder}
                    aria-label={`Clave de API de ${fila.label}`}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => guardar(fila.platform)}
                    disabled={trabajando || clave.trim().length < 8}
                  >
                    {trabajando ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <Check size={13} />
                    )}
                    Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setAbierta(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t border-[var(--line)] px-4 py-2.5 text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
        La clave se cifra en el servidor. Solo se guardan los últimos 4 caracteres para reconocerla.
      </p>
    </Card>
  );
}
