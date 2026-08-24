"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  MousePointerClick,
  Rocket,
  LoaderCircle,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import type { CampaignObjective, Company, Creator } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const OBJECTIVES: {
  id: CampaignObjective;
  label: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    id: "awareness",
    label: "Reconocimiento",
    description: "Máximo alcance y vistas por el presupuesto.",
    icon: Eye,
  },
  {
    id: "trafico",
    label: "Tráfico",
    description: "Llevar audiencia a un sitio o landing.",
    icon: MousePointerClick,
  },
  {
    id: "conversiones",
    label: "Conversiones",
    description: "Ventas o registros con código de descuento.",
    icon: Target,
  },
  {
    id: "lanzamiento",
    label: "Lanzamiento",
    description: "Concentrar publicaciones en una ventana corta.",
    icon: Rocket,
  },
];

const STEPS = ["Campaña", "Presupuesto", "Creadores"] as const;

export function NewCampaignForm({
  companies,
  creators,
}: {
  companies: Company[];
  creators: Creator[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("borrador");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [objective, setObjective] = useState<CampaignObjective>("awareness");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [picked, setPicked] = useState<string[]>([]);

  const selectedCreators = creators.filter((c) => picked.includes(c.id));
  const estimated = selectedCreators.reduce((s, c) => s + c.rateVideo, 0);

  async function save() {
    if (!name.trim()) {
      setError("La campaña necesita un nombre.");
      setStep(0);
      return;
    }
    if (!companyId) {
      setError("Selecciona el cliente que contrata.");
      setStep(0);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyId,
          status,
          objective,
          currency,
          budget: Number(budget) || 0,
          startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          notes: notes.trim(),
          creatorIds: picked,
          fees: Object.fromEntries(
            picked.map((id) => [id, creators.find((c) => c.id === id)?.rateVideo ?? 0]),
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la campaña.");
      router.push(`/campanas/`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setSaving(false);
    }
  }

  function togglePicked(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Nueva campaña" description="Registra el acuerdo y sus entregables." />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <button
                key={label}
                onClick={() => setStep(index)}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full border text-[11px] font-semibold transition",
                    done
                      ? "border-transparent bg-[var(--solid)] text-[var(--solid-fg)]"
                      : active
                        ? "border-[var(--text)] text-[var(--text)]"
                        : "border-[var(--line-strong)] text-[var(--text-subtle)]",
                  )}
                >
                  {done ? <Check size={13} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    active ? "text-[var(--text)]" : "text-[var(--text-muted)]",
                  )}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <span className="mx-1.5 h-px w-6 bg-[var(--line)]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-7">
        <Link
          href="/campanas"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Volver a campañas
        </Link>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_272px]">
          <div className="space-y-4">
            {step === 0 && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Objetivo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {OBJECTIVES.map((o) => {
                        const Icon = o.icon;
                        const active = objective === o.id;
                        return (
                          <button
                            key={o.id}
                            onClick={() => setObjective(o.id)}
                            className={cn(
                              "flex items-start gap-3 rounded-[var(--r-control)] border p-3 text-left transition",
                              active
                                ? "border-[var(--text)] bg-[var(--surface-2)]"
                                : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-control)] border",
                                active
                                  ? "border-transparent bg-[var(--solid)] text-[var(--solid-fg)]"
                                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--text-subtle)]",
                              )}
                            >
                              <Icon size={15} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium">{o.label}</span>
                              <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                                {o.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Datos de la campaña</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Cliente — Concepto de la campaña"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Cliente</Label>
                      <Select
                        id="company"
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                      >
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <FieldHint>
                        <Link href="/empresas" className="hover:text-[var(--accent)]">
                          Gestionar empresas
                        </Link>
                      </FieldHint>
                    </div>
                    <div>
                      <Label htmlFor="status">Estado inicial</Label>
                      <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="borrador">Borrador</option>
                        <option value="activa">Activa</option>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="notes">Notas del brief</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Mensajes clave, restricciones, entregables esperados…"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Presupuesto y calendario</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="budget">Presupuesto total</Label>
                    <div className="flex gap-2">
                      <Select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-24"
                        aria-label="Moneda"
                      >
                        <option>USD</option>
                        <option>MXN</option>
                        <option>COP</option>
                        <option>EUR</option>
                      </Select>
                      <Input
                        id="budget"
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <FieldHint>Solo informativo: sirve para comparar contra lo comprometido.</FieldHint>
                  </div>
                  <div>
                    <Label htmlFor="fee">Comisión de agencia (%)</Label>
                    <Input id="fee" type="number" placeholder="20" />
                  </div>
                  <div>
                    <Label htmlFor="start">Inicio</Label>
                    <Input
                      id="start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end">Fin</Label>
                    <Input
                      id="end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Creadores participantes</CardTitle>
                    <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                      Los entregables y sus enlaces se añaden después desde la campaña.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {creators.map((creator) => {
                    const active = picked.includes(creator.id);
                    return (
                      <button
                        key={creator.id}
                        onClick={() => togglePicked(creator.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[var(--r-control)] border p-3 text-left transition",
                          active
                            ? "border-[var(--text)] bg-[var(--surface-2)]"
                            : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]",
                        )}
                      >
                        <Avatar src={creator.avatarUrl} name={creator.name} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{creator.name}</p>
                          <p className="truncate text-[12px] text-[var(--text-subtle)]">
                            {creator.category} · video desde{" "}
                            {formatMoney(creator.rateVideo, creator.currency)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "grid h-5 w-5 place-items-center rounded-md border transition",
                            active
                              ? "border-transparent bg-[var(--solid)] text-[var(--solid-fg)]"
                              : "border-[var(--line-strong)]",
                          )}
                        >
                          {active && <Check size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
                <TriangleAlert size={14} className="mt-px shrink-0" />
                {error}
              </p>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Atrás
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                  Continuar
                </Button>
              ) : (
                <Button variant="primary" onClick={save} disabled={saving}>
                  {saving && <LoaderCircle size={14} className="animate-spin" />}
                  Crear campaña
                </Button>
              )}
            </div>
          </div>

          <Card className="h-fit xl:sticky xl:top-[104px]">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[var(--text-muted)]">Nombre</span>
                <span className="max-w-40 truncate text-right font-medium">
                  {name || "Sin definir"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Cliente</span>
                <span className="font-medium">
                  {companies.find((c) => c.id === companyId)?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Objetivo</span>
                <Badge tone="accent">
                  {OBJECTIVES.find((o) => o.id === objective)?.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">Presupuesto</span>
                <span className="tabular font-medium">
                  {budget ? formatMoney(Number(budget), currency as "USD") : "—"}
                </span>
              </div>

              <div className="h-px bg-[var(--line)]" />

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Users size={13} />
                  Creadores
                </span>
                <span className="font-medium">{picked.length}</span>
              </div>
              {picked.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Costo estimado</span>
                  <span className="tabular font-medium">{formatMoney(estimated)}</span>
                </div>
              )}
              <p className="text-[12px] text-[var(--text-subtle)]">
                El estimado usa la tarifa mínima por video de cada creador.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
