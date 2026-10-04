"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { useCan } from "@/components/session-provider";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/socials";
import type { CreatorStatShot, SocialPlatform } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ponerArchivo, subirABlob } from "@/lib/subir-cliente";
import { MAXIMO_CAPTURA, TIPOS_IMAGEN } from "@/lib/archivos";

/** Una cuenta del creador de la que se pueden guardar estadísticas. */
export type CuentaStats = {
  /** «principal», «canal:<id>» o «red:<id>»: lo que se guarda en la captura. */
  key: string;
  platform: SocialPlatform;
  /** El @ o el nombre con el que se reconoce. */
  nombre: string;
  /** «Canal principal», «Canal Gameplays»… */
  detalle: string;
};

/** En el selector de cuenta: una que todavía no está en la ficha. */
const OTRA = "__otra__";

/**
 * Capturas de las estadísticas del creador, separadas por cuenta.
 *
 * Es lo que se usa cuando el creador no cede la clave de su API: manda
 * pantallazos de su panel y se guardan aquí, fechados.
 *
 * Van por cuenta y no en un solo montón: un creador con tres canales de
 * YouTube y un TikTok tiene cuatro paneles distintos, y una captura de
 * «audiencia por país» no dice nada si no se sabe de cuál de ellos es. Cada
 * cuenta tiene su bloque y su botón, así que no hay que acordarse de elegirla.
 */
export function StatsPanel({
  creatorId,
  shots,
  cuentas: deLaFicha,
}: {
  creatorId: string;
  shots: CreatorStatShot[];
  /** Sus canales y redes, el principal primero. */
  cuentas: CuentaStats[];
}) {
  // Además de las de la ficha, las cuentas para las que ya se subió algo sin
  // estar registradas: un Instagram que no se dio de alta, un canal de otro
  // idioma. Salen de las propias capturas, así que no hay nada más que guardar.
  const cuentas: CuentaStats[] = [...deLaFicha];
  for (const s of shots) {
    if (!s.accountKey.startsWith("otra:") || !s.platform) continue;
    if (cuentas.some((c) => c.key === s.accountKey)) continue;
    cuentas.push({
      key: s.accountKey,
      platform: s.platform,
      nombre: s.accountLabel || PLATFORM_LABEL[s.platform],
      detalle: "No está en la ficha",
    });
  }

  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores");

  /** Cuenta para la que se sube; `null` = diálogo cerrado. */
  const [subiendoA, setSubiendoA] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<CreatorStatShot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conocidas = new Set(cuentas.map((c) => c.key));
  const de = (key: string) => shots.filter((s) => s.accountKey === key);
  // Capturas de una cuenta que ya se quitó de la ficha, o de antes de que se
  // separaran por cuenta: no se pierden, van al final.
  const sueltas = shots.filter((s) => !conocidas.has(s.accountKey));

  // Las cuentas, agrupadas por red y en el orden en que llegan.
  const redes = [...new Set(cuentas.map((c) => c.platform))];

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

  const nombreDe = (shot: CreatorStatShot) => {
    const cuenta = cuentas.find((c) => c.key === shot.accountKey);
    if (cuenta) return `${PLATFORM_LABEL[cuenta.platform]} · ${cuenta.nombre}`;
    return [shot.platform ? PLATFORM_LABEL[shot.platform] : null, shot.accountLabel].filter(Boolean).join(" · ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[12.5px] text-[var(--text-muted)]">
          Pantallazos de su panel de estadísticas, para cuando no cede acceso a su API. Cada canal
          y cada red tiene su bloque; van fechados para ver cómo cambian con el tiempo.
        </p>
        {puedeEditar && (
          <Button variant="secondary" onClick={() => setSubiendoA(OTRA)}>
            <Plus size={15} />
            Otra red o cuenta
          </Button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {redes.map((red) => (
        <section key={red}>
          <p className="eyebrow mb-2.5">{PLATFORM_LABEL[red]}</p>
          <div className="space-y-3">
            {cuentas
              .filter((c) => c.platform === red)
              .map((cuenta) => {
                const suyas = de(cuenta.key);
                return (
                  <div
                    key={cuenta.key}
                    className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]"
                  >
                    <header className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium">{cuenta.nombre}</span>
                          {suyas.length > 0 && <Badge plain>{suyas.length}</Badge>}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--text-muted)]">
                          {cuenta.detalle}
                        </span>
                      </span>
                      {puedeEditar && (
                        <Button variant="secondary" size="sm" onClick={() => setSubiendoA(cuenta.key)}>
                          <Plus size={14} />
                          Subir captura
                        </Button>
                      )}
                    </header>
                    {suyas.length === 0 ? (
                      <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-[var(--text-subtle)]">
                        Sin capturas de esta cuenta.
                      </p>
                    ) : (
                      <div className="grid gap-3 border-t border-[var(--line)] p-3 sm:grid-cols-2 xl:grid-cols-4">
                        {suyas.map((shot) => (
                          <Miniatura key={shot.id} shot={shot} onAbrir={() => setAbierta(shot)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      {sueltas.length > 0 && (
        <section>
          <p className="eyebrow mb-2.5">Otras capturas</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sueltas.map((shot) => (
              <Miniatura key={shot.id} shot={shot} pie={nombreDe(shot)} onAbrir={() => setAbierta(shot)} />
            ))}
          </div>
        </section>
      )}

      {subiendoA !== null && (
        <SubirCaptura
          creatorId={creatorId}
          cuentas={cuentas}
          cuentaInicial={subiendoA}
          onClose={() => setSubiendoA(null)}
        />
      )}

      {abierta && (
        <Modal
          open
          onClose={() => setAbierta(null)}
          size="xl"
          title={abierta.caption || "Captura de estadísticas"}
          description={[
            nombreDe(abierta) || null,
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

function Miniatura({
  shot,
  pie,
  onAbrir,
}: {
  shot: CreatorStatShot;
  /** De qué cuenta es, cuando no está dentro del bloque de esa cuenta. */
  pie?: string;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group overflow-hidden rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] text-left transition hover:border-[var(--line-strong)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shot.url}
        alt={shot.caption || "Captura de estadísticas"}
        loading="lazy"
        className="aspect-[4/3] w-full bg-[var(--surface-3)] object-cover object-top"
      />
      <span className="block p-2.5">
        <span className="block truncate text-[12.5px] font-medium group-hover:text-[var(--accent)]">
          {shot.caption || "Estadísticas"}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-muted)]">
          {[pie, shot.takenAt ? `Datos del ${formatDate(shot.takenAt)}` : `Subida el ${formatDate(shot.createdAt)}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </button>
  );
}

function SubirCaptura({
  creatorId,
  cuentas,
  cuentaInicial,
  onClose,
}: {
  creatorId: string;
  cuentas: CuentaStats[];
  cuentaInicial: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cuentaKey, setCuentaKey] = useState(cuentaInicial);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para una cuenta que no está en la ficha: su red y cómo se llama.
  const [otraRed, setOtraRed] = useState<SocialPlatform>("instagram");
  const [otraNombre, setOtraNombre] = useState("");

  const esOtra = cuentaKey === OTRA;
  const cuenta: CuentaStats | undefined = esOtra
    ? {
        key: `otra:${otraRed}:${otraNombre.trim().replace(/^@/, "").toLowerCase()}`,
        platform: otraRed,
        nombre: otraNombre.trim(),
        detalle: "No está en la ficha",
      }
    : (cuentas.find((c) => c.key === cuentaKey) ?? cuentas[0]);

  async function guardar() {
    if (!archivo) {
      setError("Elige la imagen.");
      return;
    }
    if (!cuenta) {
      setError("Elige de qué cuenta es.");
      return;
    }
    if (esOtra && !otraNombre.trim()) {
      setError("Escribe el usuario o el nombre de la cuenta.");
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
      form.set("platform", cuenta.platform);
      form.set("accountKey", cuenta.key);
      form.set("accountLabel", cuenta.nombre);
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
      description={
        esOtra
          ? "De una red o cuenta que no está en la ficha."
          : cuenta
            ? `${PLATFORM_LABEL[cuenta.platform]} · ${cuenta.nombre}`
            : undefined
      }
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
            <Label htmlFor="st-cuenta">Cuenta</Label>
            <Picker
              id="st-cuenta"
              value={cuentaKey}
              onChange={setCuentaKey}
              options={[
                ...cuentas.map((c) => ({
                  id: c.key,
                  label: c.nombre,
                  hint: `${PLATFORM_LABEL[c.platform]} · ${c.detalle}`,
                })),
                { id: OTRA, label: "Otra red o cuenta…", hint: "Una que no está en la ficha" },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="st-fecha">Fecha de los datos</Label>
            <Input id="st-fecha" type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
          </div>
        </div>
        {esOtra && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="st-otra-red">Red</Label>
              <Picker
                id="st-otra-red"
                value={otraRed}
                onChange={setOtraRed}
                options={PLATFORMS.map((p) => ({ id: p.id, label: p.label }))}
              />
            </div>
            <div>
              <Label htmlFor="st-otra-nombre">Usuario o nombre</Label>
              <Input
                id="st-otra-nombre"
                value={otraNombre}
                onChange={(e) => setOtraNombre(e.target.value)}
                placeholder="@usuario"
              />
            </div>
          </div>
        )}
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
