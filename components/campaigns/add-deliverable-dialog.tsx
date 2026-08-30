"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Link2, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { formatCompact, formatDate } from "@/lib/utils";
import type { Creator } from "@/lib/types";

type VideoPreview = {
  videoId: string;
  /** Canal que publicó el video; sirve para reconocer al creador. */
  channelId?: string;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  publishedAt: string;
  durationSeconds: number;
  isShort: boolean;
  views: number;
  likes: number | null;
  comments: number | null;
  videoUrl: string;
  source: "api" | "demo";
};

/**
 * Lee la respuesta sin dar por hecho que trae JSON.
 *
 * Un 500 del servidor puede llegar con cuerpo vacío o con una página de error,
 * y `res.json()` a secas convierte eso en «Unexpected end of JSON input», que
 * no le dice nada a nadie. Preferimos el estado real.
 */
async function leerRespuesta(res: Response, fallo: string) {
  const texto = await res.text();
  let data: { error?: string } = {};
  try {
    data = texto ? JSON.parse(texto) : {};
  } catch {
    // El cuerpo no era JSON: nos quedamos con el código de estado.
  }
  if (!res.ok) throw new Error(data.error ?? `${fallo} (error ${res.status})`);
  return data;
}

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function AddDeliverableDialog({
  open,
  onClose,
  campaignId,
  creators,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  creators: Creator[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoPreview | null>(null);
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? "");
  const [autodetectado, setAutodetectado] = useState(false);
  const [type, setType] = useState("video");
  const [fee, setFee] = useState("");

  function close() {
    setUrl("");
    setVideo(null);
    setError(null);
    setSaving(false);
    setFee("");
    setAutodetectado(false);
    onClose();
  }

  async function lookup() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/youtube/video?url=${encodeURIComponent(url)}`);
      const data = (await leerRespuesta(res, "No pudimos leer el video.")) as {
        video: VideoPreview;
      };
      const found = data.video;
      setVideo(found);
      setType(found.isShort ? "short" : "video");

      // El canal del video identifica al creador: mira el canal principal, los
      // secundarios y, si nada cuadra, el nombre del canal.
      const detectado = detectarCreador(found, creators);
      if (detectado) {
        setCreatorId(detectado.id);
        setAutodetectado(true);
      } else {
        setAutodetectado(false);
      }

      // Precarga la tarifa acordada del creador según el tipo de pieza.
      const creator = detectado ?? creators.find((c) => c.id === creatorId);
      if (creator) {
        const tarifa = found.isShort ? creator.rateShort : creator.rateVideo;
        setFee(tarifa > 0 ? String(tarifa) : "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!video) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/entregables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId,
          type,
          status: "publicado",
          agreedFee: Number(fee) || 0,
          videoId: video.videoId,
          videoUrl: video.videoUrl,
          title: video.title,
          thumbnail: video.thumbnail,
          publishedAt: video.publishedAt,
          durationSeconds: video.durationSeconds,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
        }),
      });
      await leerRespuesta(res, "No se pudo guardar el entregable.");
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
      title="Añadir entregable"
      description="Pega el enlace del video publicado y traemos sus métricas públicas."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!video || saving}>
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            Añadir a la campaña
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="video-url">Enlace del video</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2
                size={14}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-subtle)]"
              />
              <Input
                id="video-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="https://www.youtube.com/watch?v=… o /shorts/…"
                className="pl-9"
              />
            </div>
            <Button variant="primary" onClick={lookup} disabled={loading || !url.trim()}>
              {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
              Leer
            </Button>
          </div>
          <FieldHint>
            Vistas, likes, comentarios, duración y fecha. La retención y la demografía solo existen
            en la cuenta del creador.
          </FieldHint>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {video && (
          <>
            <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)]">
              <div className="flex gap-3 p-3">
                <div className="relative shrink-0">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-[68px] w-[120px] rounded-[var(--r-control)] object-cover"
                    />
                  ) : (
                    <div className="grid h-[68px] w-[120px] place-items-center rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-3)] text-[var(--text-subtle)]">
                      <Film size={17} strokeWidth={1.75} />
                    </div>
                  )}
                  <span className="absolute right-1.5 bottom-1.5 rounded-[var(--r-pill)] bg-black/80 px-1.5 py-0.5 text-[11px] text-white">
                    {duration(video.durationSeconds)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={video.isShort ? "accent" : "info"}>
                      {video.isShort ? "Short" : "Video"}
                    </Badge>
                    {video.source === "demo" && <Badge tone="warn">Modo demo</Badge>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-medium">{video.title}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-subtle)]">
                    {video.channelTitle} · {formatDate(video.publishedAt)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 border-t border-[var(--line)]">
                {[
                  { label: "Vistas", value: formatCompact(video.views) },
                  { label: "Likes", value: formatCompact(video.likes ?? 0) },
                  { label: "Comentarios", value: formatCompact(video.comments ?? 0) },
                ].map((m) => (
                  <div key={m.label} className="border-r border-[var(--line)] px-3 py-2.5 last:border-0">
                    <p className="text-[11.5px] text-[var(--text-subtle)]">{m.label}</p>
                    <p className="tabular mt-0.5 text-[16px] font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="deliverable-creator">Creador</Label>
                <Select
                  id="deliverable-creator"
                  value={creatorId}
                  onChange={(e) => {
                    setCreatorId(e.target.value);
                    setAutodetectado(false);
                  }}
                >
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {autodetectado ? (
                  <FieldHint className="text-[var(--ok)]">
                    Reconocido por el canal del video.
                  </FieldHint>
                ) : (
                  <FieldHint>
                    No reconocimos el canal. Elige a quién corresponde.
                  </FieldHint>
                )}
              </div>
              <div>
                <Label htmlFor="deliverable-type">Tipo</Label>
                <Select
                  id="deliverable-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="video">Video dedicado</option>
                  <option value="short">Reel / Short</option>
                  <option value="integracion">Fracción publicitaria</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="deliverable-fee">Tarifa acordada</Label>
                <Input
                  id="deliverable-fee"
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Reconoce al creador a partir del canal del video.
 *
 * Primero por identificador de canal, que es exacto: el principal y los
 * secundarios que tenga cargados. Solo si eso falla compara el nombre del
 * canal, que puede coincidir por casualidad y por eso va al final.
 */
function detectarCreador(video: VideoPreview, creators: Creator[]): Creator | null {
  if (video.channelId) {
    const porCanal = creators.find(
      (c) =>
        c.channelId === video.channelId ||
        c.channels.some((ch) => ch.channelId === video.channelId),
    );
    if (porCanal) return porCanal;
  }

  const titulo = video.channelTitle?.trim().toLowerCase();
  if (!titulo) return null;

  return (
    creators.find(
      (c) =>
        c.name.toLowerCase() === titulo ||
        c.handle.replace(/^@/, "").toLowerCase() === titulo.replace(/^@/, ""),
    ) ?? null
  );
}
