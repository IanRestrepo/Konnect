"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { useCan } from "@/components/session-provider";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/socials";
import type { CreatorStatShot, SocialPlatform } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ponerArchivo, subirABlob } from "@/lib/subir-cliente";
import { MAXIMO_CAPTURA, TIPOS_IMAGEN } from "@/lib/archivos";

const SIN_RED = "";

/**
 * Capturas de las estadísticas del creador.
 *
 * Es lo que se usa cuando el creador no cede la clave de su API: nos manda
 * pantallazos de su panel —alcance, audiencia por país, edades— y se guardan
 * aquí, con la red y la fecha de los datos, para enseñarlos a una marca y
 * compararlos con los de meses atrás.
 */
export function StatsPanel({
  creatorId,
  shots,
  mainPlatform,
}: {
  creatorId: string;
  shots: CreatorStatShot[];
  mainPlatform: SocialPlatform;
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  const [subiendo, setSubiendo] = useState(false);
  const [abierta, setAbierta] = useState<CreatorStatShot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quitar(shot: CreatorStatShot) {
    if (!window.confirm("¿Quitar esta captura? Se borra el archivo.")) return;
    setError(null);
    const res = await fetch(
      `/api/creadores/${creatorId}/stats?shotId=${encodeURIComponent(shot.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo quitar la captura.");
      return;
    }
    setAbierta(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[12.5px] text-[var(--text-muted)]">
          Pantallazos de su panel de estadísticas, para cuando no cede acceso a su API. Van
          fechados: sirven para enseñarlos y para ver cómo cambian con el tiempo.
        </p>
        {puedeEditar && (
          <Button variant="primary" onClick={() => setSubiendo(true)}>
            <ImagePlus size={15} />
            Subir captura
          </Button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {shots.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          title="Sin capturas"
          description="Pídele al creador pantallazos de su panel: alcance, audiencia por país y edades."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shots.map((shot) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => setAbierta(shot)}
              className="group overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] text-left transition hover:border-[var(--line-strong)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.url}
                alt={shot.caption || "Captura de estadísticas"}
                loading="lazy"
                className="aspect-[4/3] w-full bg-[var(--surface-3)] object-cover object-top"
              />
              <span className="block p-3">
                <span className="block truncate text-[13px] font-medium group-hover:text-[var(--accent)]">
                  {shot.caption || (shot.platform ? PLATFORM_LABEL[shot.platform] : "Estadísticas")}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
                  {[
                    shot.platform && shot.caption ? PLATFORM_LABEL[shot.platform] : null,
                    shot.takenAt ? `Datos del ${formatDate(shot.takenAt)}` : `Subida el ${formatDate(shot.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {subiendo && (
        <SubirCaptura
          creatorId={creatorId}
          mainPlatform={mainPlatform}
          onClose={() => setSubiendo(false)}
        />
      )}

      {abierta && (
        <Modal
          open
          onClose={() => setAbierta(null)}
          size="xl"
          title={abierta.caption || "Captura de estadísticas"}
          description={[
            abierta.platform ? PLATFORM_LABEL[abierta.platform] : null,
            abierta.takenAt ? `Datos del ${formatDate(abierta.takenAt)}` : null,
            `Subida por ${abierta.uploadedBy || "el equipo"} el ${formatDate(abierta.createdAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          footer={
            <>
              {puedeEditar && (
                <Button variant="ghost" className="mr-auto text-[var(--danger)]" onClick={() => quitar(abierta)}>
                  <Trash2 size={14} />
                  Quitar
                </Button>
              )}
              <a href={abierta.url} target="_blank" rel="noreferrer">
                <Button variant="secondary">Abrir original</Button>
              </a>
            </>
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={abierta.url}
            alt={abierta.caption || "Captura de estadísticas"}
            className="max-h-[70vh] w-full rounded-[var(--r-control)] object-contain"
          />
        </Modal>
      )}
    </div>
  );
}

function SubirCaptura({
  creatorId,
  mainPlatform,
  onClose,
}: {
  creatorId: string;
  mainPlatform: SocialPlatform;
  onClose: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [platform, setPlatform] = useState<string>(mainPlatform);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!archivo) {
      setError("Elige la imagen.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      // La imagen va del navegador a Blob; al servidor solo su dirección.
      const listo = await subirABlob(archivo, {
        carpeta: `stats/${creatorId}`,
        tipos: TIPOS_IMAGEN,
        maximo: MAXIMO_CAPTURA,
      });
      const form = new FormData();
      ponerArchivo(form, listo);
      form.set("platform", platform);
      form.set("caption", caption);
      form.set("takenAt", takenAt);
      const res = await fetch(`/api/creadores/${creatorId}/stats`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir la captura.");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={ImagePlus}
      title="Subir captura"
      description="Un pantallazo de su panel de estadísticas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando || !archivo}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            Subir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--r-card)] border border-dashed border-[var(--line-strong)] px-4 py-8 text-[13px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <ImagePlus size={16} />
            {archivo ? archivo.name : "Elegir imagen (PNG, JPG o WebP, hasta 10 MB)"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="st-red">Red</Label>
            <Picker
              id="st-red"
              value={platform}
              onChange={setPlatform}
              options={[
                ...PLATFORMS.map((p) => ({ id: p.id as string, label: p.label })),
                { id: SIN_RED, label: "Varias / otra" },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="st-fecha">Fecha de los datos</Label>
            <Input id="st-fecha" type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="st-desc">Qué muestra</Label>
          <Input
            id="st-desc"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Ej.: Audiencia por país, últimos 28 días"
          />
          <FieldHint>Opcional, pero ayuda a encontrarla después.</FieldHint>
        </div>
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
