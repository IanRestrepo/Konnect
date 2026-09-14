"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { DeliverableTypeField } from "@/components/campaigns/deliverable-type-field";
import { PLATFORMS } from "@/lib/socials";
import { DELIVERABLE_STATUS } from "@/lib/labels";
import { IMPORTE_MAXIMO } from "@/lib/pricing";
import type {
  Creator,
  Currency,
  Deliverable,
  DeliverableKind,
  DeliverableStatus,
  DeliverableType,
  PaymentStatus,
  SocialPlatform,
} from "@/lib/types";
import { formatMoney } from "@/lib/utils";

const ESTADOS = Object.entries(DELIVERABLE_STATUS).map(([id, v]) => ({
  id: id as DeliverableStatus,
  label: v.label,
}));

const PAGOS: { id: PaymentStatus; label: string }[] = [
  { id: "pendiente", label: "Sin pagar" },
  { id: "aprobado", label: "Aprobado" },
  { id: "pagado", label: "Pagado" },
];

/** `yyyy-mm-dd` para el campo de fecha; cadena vacía si no hay valor. */
function aInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Edita una pieza ya pactada.
 *
 * Era el agujero grande de la pantalla de campaña: una pieza nacía en el
 * diálogo de contratar y ahí se quedaba. No había dónde pegarle el enlace de
 * la publicación —así que la fila decía «Pendiente de publicar» con el video ya
 * arriba—, ni dónde corregir lo que se le paga al creador, que es justamente
 * el número que casi nunca se sabe el día que se contrata. El único arreglo
 * era borrar la pieza y volver a contratar, y eso se lleva por delante su
 * sesión de entrega con su código.
 */
export function EditDeliverableDialog({
  open,
  onClose,
  campaignId,
  deliverable,
  creator,
  currency,
  kinds,
  onKindsChange,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  deliverable: Deliverable | null;
  creator: Creator | null;
  currency: Currency;
  kinds: DeliverableKind[];
  onKindsChange: (kinds: DeliverableKind[]) => void;
}) {
  const router = useRouter();

  // El estado arranca en lo que tiene la pieza. Quien lo llama pone `key` con
  // el identificador del entregable, así que abrir otra fila remonta el
  // diálogo en vez de dejarlo con los datos de la anterior.
  const [platform, setPlatform] = useState<SocialPlatform>(deliverable?.platform ?? "youtube");
  const [type, setType] = useState<DeliverableType>(deliverable?.type ?? "video");
  const [customType, setCustomType] = useState(deliverable?.customType ?? "");
  const [channelId, setChannelId] = useState(deliverable?.channelId ?? "");
  const [status, setStatus] = useState<DeliverableStatus>(deliverable?.status ?? "pendiente");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    deliverable?.paymentStatus ?? "pendiente",
  );
  const [videoUrl, setVideoUrl] = useState(deliverable?.videoUrl ?? "");
  const [publishedAt, setPublishedAt] = useState(aInput(deliverable?.publishedAt ?? null));
  const [cobro, setCobro] = useState(String(deliverable?.clientPrice ?? 0));
  const [costo, setCosto] = useState(String(deliverable?.agreedFee ?? 0));
  /** Volver a leer YouTube al guardar. Solo si el enlace se tocó. */
  const [leerVideo, setLeerVideo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deliverable) return null;

  const ganancia = (Number(cobro) || 0) - (Number(costo) || 0);
  const enlaceNuevo = videoUrl.trim() && videoUrl.trim() !== (deliverable.videoUrl ?? "");

  async function guardar() {
    if (!deliverable) return;
    if (Number(cobro) > IMPORTE_MAXIMO || Number(costo) > IMPORTE_MAXIMO) {
      setError("Ese importe se pasa del máximo.");
      return;
    }
    if (ganancia < 0) {
      setError("El pago al creador no puede superar lo que paga el cliente.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/entregables/${deliverable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          type,
          customType,
          channelId,
          status,
          paymentStatus,
          videoUrl: videoUrl.trim() || null,
          publishedAt: publishedAt ? new Date(`${publishedAt}T00:00:00`).toISOString() : null,
          clientPrice: Number(cobro) || 0,
          // Se guarda como comisión fija: es exactamente la diferencia, sin
          // porcentajes que la redondeen por el camino.
          commissionFixed: Math.max((Number(cobro) || 0) - (Number(costo) || 0), 0),
          commissionPct: null,
          leerVideo: leerVideo && Boolean(videoUrl.trim()),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la pieza.");
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
      open={open}
      onClose={onClose}
      size="lg"
      icon={Pencil}
      title="Editar la pieza"
      description={creator ? `Lo pactado con ${creator.name} en esta campaña.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando && <LoaderCircle size={14} className="animate-spin" />}
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {creator && (
          <div className="flex items-center gap-3 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2.5">
            <Avatar src={creator.avatarUrl} name={creator.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{creator.name}</span>
              <span className="block truncate text-[12px] text-[var(--text-subtle)]">
                Para cambiar de creador, quita la pieza y contrata al otro.
              </span>
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ed-red">Red</Label>
            <Picker
              id="ed-red"
              value={platform}
              onChange={(red) => {
                setPlatform(red);
                // Los canales son de YouTube: fuera de ahí no aplican.
                if (red !== "youtube") setChannelId("");
              }}
              options={PLATFORMS.map((p) => ({ id: p.id, label: p.label }))}
            />
          </div>

          <DeliverableTypeField
            id="ed-pieza"
            platform={platform}
            type={type}
            customType={customType}
            kinds={kinds}
            onChange={(t, c) => {
              setType(t);
              setCustomType(c);
            }}
            onKindsChange={onKindsChange}
          />

          {platform === "youtube" && creator && creator.channels.length > 0 && (
            <div className="sm:col-span-2">
              <Label htmlFor="ed-canal">Canal</Label>
              <Picker
                id="ed-canal"
                value={channelId}
                onChange={setChannelId}
                options={[
                  { id: "", label: "Canal principal", hint: creator.handle },
                  ...creator.channels.map((c) => ({
                    id: c.id,
                    label: c.label || c.handle || "Canal",
                    hint: c.handle,
                  })),
                ]}
              />
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="ed-enlace">Enlace de la publicación</Label>
          <Input
            id="ed-enlace"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setLeerVideo(true);
            }}
            placeholder="https://youtube.com/watch?v=…"
          />
          <FieldHint>
            {enlaceNuevo
              ? "Al guardar se intenta leer de YouTube el título, la miniatura y las vistas."
              : "Déjalo vacío mientras la pieza siga sin publicarse."}
          </FieldHint>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ed-fecha">Fecha de publicación</Label>
            <Input
              id="ed-fecha"
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ed-estado">Estado de la pieza</Label>
            <Picker id="ed-estado" value={status} onChange={setStatus} options={ESTADOS} />
          </div>

          <div>
            <Label htmlFor="ed-cobro">Pago del cliente</Label>
            <Input
              id="ed-cobro"
              type="number"
              min={0}
              value={cobro}
              onChange={(e) => setCobro(e.target.value)}
              placeholder="0"
              className="tabular"
            />
          </div>

          <div>
            <Label htmlFor="ed-costo">Pago al creador</Label>
            <Input
              id="ed-costo"
              type="number"
              min={0}
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              placeholder="0"
              className="tabular"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="ed-pago">Estado del pago</Label>
            <Picker id="ed-pago" value={paymentStatus} onChange={setPaymentStatus} options={PAGOS} />
            <FieldHint>Lo ve el creador en su portal.</FieldHint>
          </div>
        </div>

        {/* Las tres cifras a la vista, como al contratar: no debe quedar duda
            de a dónde va cada peso. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
          <span className="text-[var(--text-muted)]">
            Cobras {formatMoney(Number(cobro) || 0, currency)}
          </span>
          <span className="text-[var(--text-subtle)]">·</span>
          <span className="text-[var(--text-muted)]">
            le pagas {formatMoney(Number(costo) || 0, currency)}
          </span>
          <span className="text-[var(--text-subtle)]">·</span>
          <span className={ganancia < 0 ? "text-[var(--danger)]" : "font-medium"}>
            quedan {formatMoney(ganancia, currency)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
