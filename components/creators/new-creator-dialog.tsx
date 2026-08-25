"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle, Lock, Search, TriangleAlert, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, InputWithIcon, Label, Select, Textarea } from "@/components/ui/field";
import { CATEGORIES, CURRENCIES, PAYMENT_METHOD } from "@/lib/labels";
import { PLATFORMS, PLATFORM_URL } from "@/lib/socials";
import type { PaymentMethod, SocialPlatform } from "@/lib/types";
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

/** Las que la agencia usa a diario van primero; el resto se añaden luego. */
const PLATAFORMAS_ALTA: SocialPlatform[] = ["youtube", "tiktok", "instagram", "twitch", "kick"];

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

/** Datos que en YouTube llegan de la API y en el resto se escriben a mano. */
const PERFIL_VACIO = { name: "", handle: "", url: "", followers: "" };

export function NewCreatorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<SocialPlatform>("youtube");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelPreview | null>(null);
  const [perfil, setPerfil] = useState({ ...PERFIL_VACIO });
  const [methods, setMethods] = useState<PaymentMethod[]>(["transferencia"]);
  const [form, setForm] = useState({ ...EMPTY });

  const esYoutube = platform === "youtube";
  // En YouTube hace falta buscar el canal; en el resto basta con el nombre.
  const listo = esYoutube ? Boolean(channel) : Boolean(perfil.name.trim());

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    setPlatform("youtube");
    setUrl("");
    setChannel(null);
    setPerfil({ ...PERFIL_VACIO });
    setError(null);
    setLoading(false);
    setSaving(false);
    setMethods(["transferencia"]);
    setForm({ ...EMPTY });
    onClose();
  }

  function cambiarPlataforma(next: SocialPlatform) {
    setPlatform(next);
    setChannel(null);
    setPerfil({ ...PERFIL_VACIO });
    setError(null);
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
    if (!listo) return;
    setSaving(true);
    setError(null);

    const handle = esYoutube ? channel!.handle : perfil.handle.trim() || perfil.name.trim();
    const enlace = esYoutube
      ? channel!.channelUrl
      : perfil.url.trim() || PLATFORM_URL[platform](handle);
    const seguidores = esYoutube ? channel!.subscribers : Number(perfil.followers) || 0;

    try {
      const res = await fetch("/api/creadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: esYoutube ? channel!.name : perfil.name.trim(),
          handle,
          mainPlatform: platform,
          // Los campos de canal solo existen en YouTube.
          channelId: esYoutube ? channel!.channelId : "",
          channelUrl: esYoutube ? channel!.channelUrl : "",
          avatarUrl: esYoutube ? channel!.avatarUrl : null,
          country: esYoutube ? (channel!.country ?? "") : "",
          subscribers: seguidores,
          totalViews: esYoutube ? channel!.totalViews : 0,
          videoCount: esYoutube ? channel!.videoCount : 0,
          socials: [{ platform, handle, url: enlace, followers: seguidores }],
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

  const etiqueta = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      icon={UserPlus}
      title="Añadir creador"
      description="Elige dónde publica. De YouTube traemos los datos solos; el resto se escribe a mano."
      footerNote={listo ? undefined : "Completa la plataforma para seguir"}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!listo || saving}>
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            Guardar creador
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Plataforma principal</Label>
          <div className="flex flex-wrap gap-1.5">
            {PLATAFORMAS_ALTA.map((id) => {
              const activa = id === platform;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => cambiarPlataforma(id)}
                  className={cn(
                    "h-8 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                    activa
                      ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}
                >
                  {PLATFORMS.find((p) => p.id === id)?.label ?? id}
                </button>
              );
            })}
          </div>
          <FieldHint>Podrás añadirle más perfiles desde su ficha.</FieldHint>
        </div>

        {esYoutube ? (
          <div>
            <Label htmlFor="channel-url">Enlace del canal</Label>
            <div className="flex gap-2">
              <InputWithIcon
                id="channel-url"
                icon={<Link2 size={14} />}
                wrapperClassName="flex-1"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="https://www.youtube.com/@creador"
              />
              <Button variant="primary" onClick={lookup} disabled={loading || !url.trim()}>
                {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar
              </Button>
            </div>
            <FieldHint>Acepta /@handle, /channel/UC…, /c/nombre o el ID del canal.</FieldHint>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="perfil-name">Nombre</Label>
              <Input
                id="perfil-name"
                value={perfil.name}
                onChange={(e) => setPerfil({ ...perfil, name: e.target.value })}
                placeholder="Nombre del creador"
              />
            </div>
            <div>
              <Label htmlFor="perfil-handle">Usuario en {etiqueta}</Label>
              <Input
                id="perfil-handle"
                value={perfil.handle}
                onChange={(e) => setPerfil({ ...perfil, handle: e.target.value })}
                placeholder="@usuario"
              />
            </div>
            <div>
              <Label htmlFor="perfil-url">Enlace del perfil</Label>
              <InputWithIcon
                id="perfil-url"
                icon={<Link2 size={14} />}
                value={perfil.url}
                onChange={(e) => setPerfil({ ...perfil, url: e.target.value })}
                placeholder="Se arma solo si lo dejas vacío"
              />
            </div>
            <div>
              <Label htmlFor="perfil-followers">Seguidores</Label>
              <Input
                id="perfil-followers"
                type="number"
                min={0}
                value={perfil.followers}
                onChange={(e) => setPerfil({ ...perfil, followers: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {error}
          </p>
        )}

        {esYoutube && channel && (
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
        )}

        {listo && (
          <>
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
                <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value)}>
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
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
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
