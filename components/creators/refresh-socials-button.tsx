"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/session-provider";
import { cn, formatCompact } from "@/lib/utils";

type Resultado =
  | { red: string; ok: true; followers: number }
  | { red: string; ok: false; error: string };

/**
 * Trae de TikTok e Instagram los seguidores del creador.
 *
 * Antes este botón estaba en la ficha sin hacer nada. La lectura tarda
 * —Apify abre el perfil cada vez—, así que se dice que está trabajando y,
 * al terminar, qué se leyó de cada red y qué falló.
 */
export function RefreshSocialsButton({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const can = useCan();
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; mal: boolean } | null>(null);

  if (!can("editar_creadores")) return null;

  async function leer() {
    setLeyendo(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/redes/leer`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        resultados?: Resultado[];
      };
      if (!res.ok) throw new Error(data.error ?? "No se pudieron leer las redes.");
      const r = data.resultados ?? [];
      setMensaje({
        texto: r
          .map((x) => (x.ok ? `${x.red}: ${formatCompact(x.followers)} seguidores` : `${x.red}: ${x.error}`))
          .join(" · "),
        mal: r.some((x) => !x.ok),
      });
      router.refresh();
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : "Error inesperado", mal: true });
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <span className="relative">
      <Button
        variant="secondary"
        size="icon-lg"
        onClick={leer}
        disabled={leyendo}
        aria-label="Actualizar seguidores de TikTok e Instagram"
        title="Actualizar seguidores de TikTok e Instagram"
      >
        <RefreshCw size={17} strokeWidth={1.75} className={cn(leyendo && "animate-spin")} />
      </Button>
      {(leyendo || mensaje) && (
        <span
          role="status"
          className={cn(
            "absolute top-full right-0 z-20 mt-2 w-64 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]",
            mensaje?.mal ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
          )}
        >
          {leyendo ? "Leyendo TikTok e Instagram… puede tardar medio minuto." : mensaje?.texto}
          {!leyendo && (
            <button
              type="button"
              onClick={() => setMensaje(null)}
              className="ml-2 text-[var(--text-subtle)] hover:text-[var(--text)]"
            >
              Cerrar
            </button>
          )}
        </span>
      )}
    </span>
  );
}
