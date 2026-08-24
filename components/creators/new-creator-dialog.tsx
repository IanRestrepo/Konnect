"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle, Lock, Search, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { PAYMENT_METHOD } from "@/lib/labels";
import type { PaymentMethod } from "@/lib/types";
import { cn, formatCompact } from "@/lib/utils";

type ChannelPreview = {
  channelId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  country: string | null;
  channelUrl: string;
  source: "api" | "demo";
};

const CATEGORIES = [
  "Tecnología",
  "Gaming",
  "Lifestyle",
  "Belleza",
  "Fitness",
  "Finanzas",
  "Educación",
  "Entretenimiento",
  "Automotriz",
  "Cocina",
];

const EMPTY = {
  category: CATEGORIES[0],
  status: "prospecto",
  email: "",
  phone: "",
  currency: "USD",
  rateVideo: "",
  rateShort: "",
  rateIntegration: "",
  holder: "",
  bankName: "",
  accountNumber: "",
  routing: "",
  taxId: "",
  paypalEmail: "",
  notes: "",
};

export function NewCreatorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelPreview | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>(["transferencia"]);
  const [form, setForm] = useState({ ...EMPTY });

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    setUrl("");
    setChannel(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    setMethods(["transferencia"]);
    setForm({ ...EMPTY });
    onClose();
  }

  async function lookup() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/youtube/canal?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos leer el canal.");
      setChannel(data.channel as ChannelPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!channel) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/creadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: channel.name,
          handle: channel.handle,
          channelId: channel.channelId,
          channelUrl: channel.channelUrl,
          avatarUrl: channel.avatarUrl,
          country: channel.country ?? "",
          subscribers: channel.subscribers,
          totalViews: channel.totalViews,
          videoCount: channel.videoCount,
          category: form.category,
          status: form.status,
          email: form.email.trim(),
          phone: form.phone.trim(),
          currency: form.currency,
          rateVideo: Number(form.rateVideo) || 0,
          rateShort: Number(form.rateShort) || 0,
          rateIntegration: Number(form.rateIntegration) || 0,
          paymentMethods: methods,
          banking: {
            holder: form.holder.trim(),
            bankName: form.bankName.trim(),
            accountNumber: form.accountNumber.trim(),
            routing: form.routing.trim(),
            taxId: form.taxId.trim(),
            paypalEmail: form.paypalEmail.trim() || undefined,
          },
          notes: form.notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      router.refresh();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  function toggleMethod(id: PaymentMethod) {
    setMethods((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Añadir creador"
      description="Pega el enlace del canal de YouTube y completamos los datos públicos."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!channel || saving}>
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            Guardar creador
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="channel-url">Enlace del canal</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2
                size={14}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-subtle)]"
              />
              <Input
                id="channel-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="https://www.youtube.com/@creador"
                className="pl-9"
              />
            </div>
            <Button variant="primary" onClick={lookup} disabled={loading || !url.trim()}>
              {loading ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              Buscar
            </Button>
          </div>
          <FieldHint>Acepta /@handle, /channel/UC…, /c/nombre o el ID del canal.</FieldHint>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {channel && (
          <>
            <div className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
              <div className="flex items-start gap-3">
                <Avatar src={channel.avatarUrl} name={channel.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{channel.name}</p>
                    {channel.source === "demo" ? (
                      <Badge tone="warn">Modo demo</Badge>
                    ) : (
                      <Badge tone="ok">Verificado</Badge>
                    )}
                  </div>
                  <p className="truncate text-[12px] text-[var(--text-subtle)]">
                    {channel.handle} · {channel.channelId}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Suscriptores", value: formatCompact(channel.subscribers) },
                  { label: "Vistas totales", value: formatCompact(channel.totalViews) },
                  { label: "Videos", value: formatCompact(channel.videoCount) },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                  >
                    <p className="tabular text-[16px] font-semibold">{s.value}</p>
                    <p className="text-[11.5px] text-[var(--text-subtle)]">{s.label}</p>
                  </div>
                ))}
              </div>

              {channel.source === "demo" && (
                <p className="mt-3 text-[12px] text-[var(--warn)]">
                  Sin YOUTUBE_API_KEY los datos son de ejemplo. Configúrala en Configuración →
                  Integraciones para leer canales reales.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select
                  id="category"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  id="status"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="activo">Activo</option>
                  <option value="pausado">En pausa</option>
                  <option value="prospecto">Prospecto</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="email">Correo de contacto</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contacto@creador.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+52 55 0000 0000"
                />
              </div>
            </div>

            <div>
              <Label>Métodos de pago</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((id) => {
                  const active = methods.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleMethod(id)}
                      className={cn(
                        "h-8 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                        active
                          ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                      )}
                    >
                      {PAYMENT_METHOD[id]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Tarifas mínimas acordadas</Label>
              <div className="grid gap-3 sm:grid-cols-4">
                <Select
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  aria-label="Moneda"
                >
                  <option>USD</option>
                  <option>MXN</option>
                  <option>COP</option>
                  <option>EUR</option>
                </Select>
                <Input
                  type="number"
                  value={form.rateVideo}
                  onChange={(e) => set("rateVideo", e.target.value)}
                  placeholder="Video"
                  aria-label="Tarifa por video"
                />
                <Input
                  type="number"
                  value={form.rateShort}
                  onChange={(e) => set("rateShort", e.target.value)}
                  placeholder="Reel / Short"
                  aria-label="Tarifa por short"
                />
                <Input
                  type="number"
                  value={form.rateIntegration}
                  onChange={(e) => set("rateIntegration", e.target.value)}
                  placeholder="Integración"
                  aria-label="Tarifa por fracción publicitaria"
                />
              </div>
              <FieldHint>
                Video dedicado · Reel/Short · Fracción publicitaria dentro de un video.
              </FieldHint>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Lock size={13} className="text-[var(--text-subtle)]" />
                <Label className="mb-0">Información bancaria (confidencial)</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={form.holder}
                  onChange={(e) => set("holder", e.target.value)}
                  placeholder="Titular de la cuenta"
                />
                <Input
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                  placeholder="Banco"
                />
                <Input
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  placeholder="Número de cuenta / CLABE / IBAN"
                />
                <Input
                  value={form.routing}
                  onChange={(e) => set("routing", e.target.value)}
                  placeholder="SWIFT / routing"
                />
                <Input
                  value={form.taxId}
                  onChange={(e) => set("taxId", e.target.value)}
                  placeholder="RFC / NIT / CUIT"
                />
                <Input
                  value={form.paypalEmail}
                  onChange={(e) => set("paypalEmail", e.target.value)}
                  placeholder="Correo de PayPal (opcional)"
                />
              </div>
              <FieldHint>Solo se muestra tras introducir el código de acceso.</FieldHint>
            </div>

            <div>
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Restricciones, tiempos de entrega, preferencias…"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
