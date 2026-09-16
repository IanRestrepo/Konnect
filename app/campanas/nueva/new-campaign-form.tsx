"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  LoaderCircle,
  MousePointerClick,
  Plus,
  Rocket,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageTitle } from "@/components/ui/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { SearchInput, Segmented } from "@/components/shell/toolbar";
import { useCan } from "@/components/session-provider";
import { QuickCompanyDialog } from "@/components/companies/quick-company-dialog";
import { DeliverableTypeField } from "@/components/campaigns/deliverable-type-field";
import {
  PLATFORM_LABEL,
  PLATFORMS,
  TAREAS,
  nombreCanal,
  piezaLabel,
  tareaLabel,
} from "@/lib/socials";
import { Paginador, usePagina } from "@/components/ui/pager";
import {
  IMPORTE_MAXIMO,
  MARGEN_AGENCIA,
  clientPriceForRate,
  hasRateFor,
  rateFor,
  tarifaCanal,
} from "@/lib/pricing";
import type {
  CampaignObjective,
  Company,
  Creator,
  DeliverableKind,
  DeliverableType,
  SocialPlatform,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { BackLink } from "@/components/ui/back-link";

const OBJECTIVES: {
  id: CampaignObjective;
  label: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    id: "awareness",
    label: "Reconocimiento",
    description: "Máximo alcance y vistas por lo invertido.",
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

const STEPS = ["Campaña", "Creadores", "Cierre"] as const;

/**
 * Una línea del acuerdo. El número que se escribe es lo que paga el cliente;
 * de ahí sale la comisión y lo que le queda al creador.
 *
 * Los importes viven como texto para que el campo pueda estar vacío: con
 * números, un `0` inicial se queda pegado delante de lo que escribes.
 */
type Linea = {
  creatorId: string;
  platform: SocialPlatform;
  type: DeliverableType;
  /** Nombre propio del encargo. Vacío = la tarea estándar de esa red. */
  customType: string;
  /** Canal secundario pactado. Vacío = su canal principal. */
  channelId: string;
  /** Lo que paga el cliente por esta pieza. */
  clientPrice: string;
  /** Lo que cuesta el influencer. La resta es la ganancia bruta. */
  creatorCost: string;
};

export function NewCampaignForm({
  companies,
  creators,
  empleados,
  responsablePorDefecto,
  kinds,
}: {
  companies: Company[];
  creators: Creator[];
  empleados: { id: string; name: string; avatarUrl: string | null }[];
  responsablePorDefecto: string;
  /** Tipos de pieza propios de la agencia, además de los de fábrica. */
  kinds: DeliverableKind[];
}) {
  const router = useRouter();
  const can = useCan();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [clientes, setClientes] = useState(companies);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [creandoCliente, setCreandoCliente] = useState(false);
  // El catálogo llega del servidor pero puede crecer sin recargar: el campo de
  // tipo de pieza deja crear uno en el sitio.
  const [catalogo, setCatalogo] = useState(kinds);
  // Activa de partida: casi todas las campañas se dan de alta cuando ya están
  // cerradas con el cliente, y el borrador se quedaba olvidado en ese estado.
  const [status, setStatus] = useState("activa");
  const [objective, setObjective] = useState<CampaignObjective>("awareness");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [managerId, setManagerId] = useState(responsablePorDefecto);

  /** Tope de referencia, opcional. No reparte nada. */
  const [budget, setBudget] = useState("");

  // Filtros del buscador de creadores.
  const [platform, setPlatform] = useState<SocialPlatform>("youtube");
  const [tipo, setTipo] = useState<DeliverableType>("video");
  /** Nombre propio del encargo. Vacío = la tarea estándar de esa red. */
  const [tipoPropio, setTipoPropio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  /**
   * Aviso de que cambiar de red obligó a cambiar la pieza.
   *
   * Antes se sustituía en silencio, y ahí se perdía lo que habías pedido: al
   * pasar por Instagram, que no admite menciones dentro de un video, un
   * `integracion` se convertía en `short` y al volver a YouTube se quedaba en
   * Short, porque YouTube sí los tiene. Acababas encargando un Short sin
   * haberlo elegido nunca.
   */
  const [avisoTipo, setAvisoTipo] = useState<string | null>(null);

  /**
   * Lo que se eligió en cada red, para devolverlo al volver a ella.
   *
   * El aviso de arriba no bastaba: pasar por Instagram «solo para mirar»
   * cambiaba el video dedicado por un Reel, y al volver a YouTube se quedaba
   * en Short porque YouTube también los tiene. Se contrataba un Short —a
   * cero, si el creador no tenía tarifa de Short— sin haberlo pedido nunca.
   */
  const [tipoPorRed, setTipoPorRed] = useState<
    Partial<Record<SocialPlatform, { type: DeliverableType; customType: string }>>
  >({});

  const [lineas, setLineas] = useState<Linea[]>([]);

  /** Categorías reales de los creadores que están en la red elegida. */
  const categorias = useMemo(() => {
    const enRed = creators.filter((c) => estaEn(c, platform));
    return [...new Set(enRed.flatMap((c) => c.categories).filter(Boolean))].sort();
  }, [creators, platform]);

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return creators
      .filter((c) => estaEn(c, platform))
      // Por cualquiera de sus categorías, no solo la principal.
      .filter((c) => !categoria || c.categories.includes(categoria))
      .filter(
        (c) =>
          !texto ||
          c.name.toLowerCase().includes(texto) ||
          c.handle.toLowerCase().includes(texto),
      );
  }, [creators, platform, categoria, busqueda]);

  const comisionBase = MARGEN_AGENCIA;

  // De diez en diez: con cien creadores en YouTube la lista no se acababa.
  const pagina = usePagina(resultados, `${platform}|${categoria}|${busqueda}`);

  /** Las tres cifras de una línea: lo que entra, lo que sale y la diferencia. */
  function cuentas(l: Linea) {
    const cobro = Number(l.clientPrice) || 0;
    const creador = Number(l.creatorCost) || 0;
    return { cobro, creador, ganancia: cobro - creador };
  }

  const totales = lineas.reduce(
    (acc, l) => {
      const { cobro, creador, ganancia } = cuentas(l);
      return {
        cliente: acc.cliente + cobro,
        creadores: acc.creadores + creador,
        agencia: acc.agencia + ganancia,
      };
    },
    { cliente: 0, agencia: 0, creadores: 0 },
  );

  function alternar(creator: Creator) {
    // La línea se identifica también por la pieza: al mismo creador se le puede
    // encargar un video dedicado y una mención en la misma red, y son dos
    // acuerdos con dos precios. Sin el tipo, el segundo encargo desmarcaba el
    // primero en vez de añadirse.
    const mismaLinea = (l: Linea) =>
      l.creatorId === creator.id &&
      l.platform === platform &&
      l.type === tipo &&
      l.customType === tipoPropio;

    if (lineas.some(mismaLinea)) {
      setLineas((prev) => prev.filter((l) => !mismaLinea(l)));
      return;
    }

    // La tarifa del creador es lo que él quiere recibir, así que el cobro de
    // partida la incluye más la comisión: si pide 1.000 y la agencia se lleva
    // el 20%, hay que cobrar 1.250, no 1.200.
    const tarifa = rateFor(creator, platform, tipo);
    const partida = tarifa > 0 ? Math.round(clientPriceForRate(tarifa, comisionBase)) : 0;

    setLineas((prev) => [
      ...prev,
      {
        creatorId: creator.id,
        platform,
        type: tipo,
        customType: tipoPropio,
        // Se parte de su canal principal; el canal concreto se elige después,
        // en el paso de precios, que es donde importa cuál cambia la tarifa.
        channelId: "",
        clientPrice: partida ? String(partida) : "",
        creatorCost: tarifa > 0 ? String(tarifa) : "",
      },
    ]);
  }

  /**
   * Cambia el canal de una línea y vuelve a proponer su precio.
   *
   * Un canal secundario suele tener su propia tarifa: dejar el precio del
   * principal después de cambiarlo es justo el error que se quiere evitar.
   */
  function cambiarCanal(indice: number, channelId: string) {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== indice) return l;
        const creator = creators.find((c) => c.id === l.creatorId);
        if (!creator) return { ...l, channelId };
        const tarifa = rateFor(creator, l.platform, l.type, channelId);
        const partida = tarifa > 0 ? Math.round(clientPriceForRate(tarifa, comisionBase)) : 0;
        return {
          ...l,
          channelId,
          clientPrice: partida ? String(partida) : "",
          creatorCost: tarifa > 0 ? String(tarifa) : "",
        };
      }),
    );
  }

  function editarLinea(indice: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...patch } : l)));
  }

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

    // La base guarda Decimal(12,2): más de eso revienta la inserción.
    const pasado = lineas.find((l) => Number(l.clientPrice) > IMPORTE_MAXIMO);
    if (pasado) {
      const quien = creators.find((c) => c.id === pasado.creatorId)?.name ?? "un creador";
      setError(`El cobro de ${quien} se pasa del máximo (9.999.999.999,99).`);
      setStep(2);
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
          budget: budget.trim() ? Number(budget) : null,
          agencyFee: MARGEN_AGENCIA,
          startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          notes: notes.trim(),
          managerId: managerId || null,
          lineas: lineas.map((l) => ({
            creatorId: l.creatorId,
            platform: l.platform,
            type: l.type,
            customType: l.customType,
            channelId: l.channelId,
            clientPrice: Number(l.clientPrice) || 0,
            commissionPct: null,
            // La ganancia se guarda como comisión fija: es exactamente la
            // diferencia, sin porcentajes que la redondeen por el camino.
            commissionFixed: Math.max(
              (Number(l.clientPrice) || 0) - (Number(l.creatorCost) || 0),
              0,
            ),
          })),
        }),
      });
      // El cuerpo puede venir vacío en un 500: parsear a ciegas convierte el
      // fallo real en «Unexpected end of JSON input», que no dice nada.
      const texto = await res.text();
      let data: { error?: string; id?: string } = {};
      try {
        data = texto ? JSON.parse(texto) : {};
      } catch {
        // No era JSON: nos quedamos con el código de estado.
      }
      if (!res.ok) {
        throw new Error(data.error ?? `No se pudo crear la campaña (error ${res.status}).`);
      }
      // A la campaña recién creada, no al listado: lo siguiente que se hace
      // siempre es entrar en ella, y había que buscarla.
      router.push(data.id ? `/campanas/${data.id}` : "/campanas");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Nueva campaña"
        description="El precio se pacta con cada creador, no se reparte un total."
      />

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <button key={label} onClick={() => setStep(index)} className="flex items-center gap-2">
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

      <BackLink fallbackHref="/campanas" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_272px]">
        <div className="space-y-4">
          {error && (
            <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
              <TriangleAlert size={14} className="mt-px shrink-0" />
              {error}
            </p>
          )}

          {/* ---------------- Paso 1: la campaña ---------------- */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Datos de la campaña</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Lanzamiento de verano"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Cliente</Label>
                    <div className="flex gap-2">
                      <Picker
                        id="company"
                        value={companyId}
                        onChange={setCompanyId}
                        placeholder={clientes.length ? "Selecciona…" : "Sin empresas todavía"}
                        options={clientes.map((c) => ({
                          id: c.id,
                          label: c.name,
                          hint: c.industry,
                        }))}
                        className="min-w-0 flex-1"
                      />
                      {/* Dar de alta al cliente aquí mismo, como ya se hacía
                          con las categorías del creador: mandar a Empresas a
                          quien está a medio armar la campaña es perder la
                          campaña a medias. */}
                      {can("editar_empresas") && (
                        <button
                          type="button"
                          onClick={() => setCreandoCliente(true)}
                          aria-label="Crear un cliente"
                          title="Crear un cliente"
                          className="grid h-10 w-9 shrink-0 place-items-center rounded-[var(--r-control)] border border-[var(--line)] text-[var(--text-subtle)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                        >
                          <Plus size={15} />
                        </button>
                      )}
                    </div>
                    {clientes.length === 0 && (
                      <FieldHint>Crea el primero con el botón de al lado.</FieldHint>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Objetivo</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {OBJECTIVES.map((o) => {
                      const Icono = o.icon;
                      const activo = objective === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setObjective(o.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-[var(--r-control)] border p-3 text-left transition",
                            activo
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                          )}
                        >
                          <Icono size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                          <span>
                            <span className="block text-[13.5px] font-medium">{o.label}</span>
                            <span className="block text-[12.5px] text-[var(--text-muted)]">
                              {o.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* La moneda va aquí, antes de poner precios: es lo que decide
                    con qué números se rellena el paso siguiente. El margen ya
                    no se pregunta: es siempre el de la agencia. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="moneda">Moneda</Label>
                    <Picker
                      id="moneda"
                      value={currency}
                      onChange={setCurrency}
                      options={[
                        { id: "USD", label: "USD" },
                        { id: "MXN", label: "MXN" },
                        { id: "COP", label: "COP" },
                        { id: "EUR", label: "EUR" },
                      ]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="budget">Tope de referencia</Label>
                    <Importe
                      id="budget"
                      value={budget}
                      onChange={setBudget}
                      placeholder="Opcional"
                    />
                    <FieldHint>Solo para comparar. No reparte nada.</FieldHint>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="status">Estado</Label>
                    <Picker
                      id="status"
                      value={status}
                      onChange={setStatus}
                      options={[
                        { id: "activa", label: "Activa" },
                        { id: "pausada", label: "Pausada" },
                        { id: "borrador", label: "Borrador" },
                      ]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inicio">Inicio</Label>
                    <Input
                      id="inicio"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fin">Fin</Label>
                    <Input
                      id="fin"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="manager">Responsable</Label>
                  <Picker
                    id="manager"
                    value={managerId}
                    onChange={setManagerId}
                    options={[
                      { id: "", label: "Sin responsable" },
                      ...empleados.map((e) => ({ id: e.id, label: e.name })),
                    ]}
                  />
                  <FieldHint>
                    Quien la lleva. Los encargados se añaden después, desde la ficha.
                  </FieldHint>
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Condiciones acordadas, referencias, lo que convenga recordar."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ---------------- Paso 2: los creadores ---------------- */}
          {step === 1 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Dónde se publica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Red social</Label>
                    <div className="mt-2">
                      <Segmented
                        options={PLATFORMS.filter((p) => p.id !== "web").map((p) => ({
                          id: p.id,
                          label: p.label,
                          count: creators.filter((c) => estaEn(c, p.id)).length,
                        }))}
                        value={platform}
                        onChange={(id) => {
                          // Se apunta lo de la red que se deja antes de irse,
                          // para devolverlo intacto al volver.
                          setTipoPorRed((prev) => ({
                            ...prev,
                            [platform]: { type: tipo, customType: tipoPropio },
                          }));
                          setPlatform(id);
                          setCategoria("");

                          const guardado = tipoPorRed[id];
                          if (guardado) {
                            setTipo(guardado.type);
                            setTipoPropio(guardado.customType);
                            setAvisoTipo(null);
                            return;
                          }

                          // Un Reel no existe en Twitch: se cae a la primera
                          // tarea que sí tenga sentido en la red elegida, pero
                          // diciéndolo, que es lo que faltaba.
                          // Con un tipo propio elegido no hay nada que caer:
                          // «Unboxing» vale igual en YouTube que en Twitch.
                          if (!tipoPropio && !TAREAS[id].some((t) => t.type === tipo)) {
                            const anterior = tareaLabel(platform, tipo);
                            const nueva = TAREAS[id][0];
                            setTipo(nueva.type);
                            setAvisoTipo(
                              `${PLATFORM_LABEL[id]} no admite «${anterior}». Se cambió a «${nueva.label}».`,
                            );
                          } else {
                            setAvisoTipo(null);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <DeliverableTypeField
                        id="tipo"
                        platform={platform}
                        type={tipo}
                        customType={tipoPropio}
                        kinds={catalogo}
                        onChange={(t, propio) => {
                          setTipo(t);
                          setTipoPropio(propio);
                          setAvisoTipo(null);
                        }}
                        onKindsChange={setCatalogo}
                      />
                      {avisoTipo ? (
                        <FieldHint className="text-[var(--warn)]">{avisoTipo}</FieldHint>
                      ) : (
                        <FieldHint>Determina qué tarifa del creador se aplica.</FieldHint>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="categoria">Categoría de contenido</Label>
                      <Picker
                        id="categoria"
                        value={categoria}
                        onChange={setCategoria}
                        options={[
                          { id: "", label: "Todas" },
                          ...categorias.map((c) => ({ id: c, label: c })),
                        ]}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Creadores en {PLATFORM_LABEL[platform]}
                    <span className="ml-2 text-[12.5px] font-normal text-[var(--text-muted)]">
                      {resultados.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SearchInput
                    value={busqueda}
                    onChange={setBusqueda}
                    placeholder="Buscar por nombre o usuario"
                  />

                  {/* Los elegidos, siempre a la vista. Sin esto, cambiar el
                      filtro de categoría o el tipo de pieza hacía desaparecer
                      la marca, y parecía que el creador se había quitado
                      aunque seguía dentro. */}
                  {lineas.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--r-control)] bg-[var(--surface-2)] p-2">
                      <span className="px-1 text-[12px] text-[var(--text-muted)]">
                        Elegidos ({lineas.length}):
                      </span>
                      {lineas.map((l, i) => {
                        const quien = creators.find((c) => c.id === l.creatorId);
                        return (
                          <span
                            key={`${l.creatorId}-${l.platform}-${l.type}-${l.customType}`}
                            className="inline-flex h-7 items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] pr-1 pl-1 text-[12px]"
                          >
                            <Avatar src={quien?.avatarUrl ?? null} name={quien?.name ?? "?"} size={18} />
                            <span className="max-w-[180px] truncate">
                              {quien?.name ?? "Creador"} ·{" "}
                              <span className="text-[var(--text-muted)]">
                                {PLATFORM_LABEL[l.platform]} ·{" "}
                                {piezaLabel(l.platform, l.type, l.customType)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setLineas((p) => p.filter((_, j) => j !== i))}
                              aria-label={`Quitar a ${quien?.name ?? "este creador"}`}
                              className="grid h-5 w-5 place-items-center rounded-full text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {resultados.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
                      Ningún creador con perfil en {PLATFORM_LABEL[platform]}
                      {categoria && ` y categoría ${categoria}`}.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {pagina.visibles.map((creator) => {
                        const active = lineas.some(
                          (l) =>
                            l.creatorId === creator.id &&
                            l.platform === platform &&
                            l.type === tipo &&
                            l.customType === tipoPropio,
                        );
                        // Ya contratado en esta red para otra pieza: se dice,
                        // para que no parezca que la marca se perdió.
                        const otras = lineas.filter(
                          (l) =>
                            l.creatorId === creator.id &&
                            l.platform === platform &&
                            !(l.type === tipo && l.customType === tipoPropio),
                        );
                        const precio = rateFor(creator, platform, tipo);
                        const propia = hasRateFor(creator, platform, tipo);

                        return (
                          <button
                            key={creator.id}
                            onClick={() => alternar(creator)}
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
                                {creator.categories.join(", ")} ·{" "}
                                {precio > 0 ? (
                                  <>
                                    {formatMoney(precio, creator.currency)}
                                    {!propia && " (tarifa general)"}
                                  </>
                                ) : (
                                  "sin tarifa para esta red"
                                )}
                              </p>
                            </div>
                            {otras.length > 0 && (
                              <Badge tone="accent">
                                Ya tiene {piezaLabel(platform, otras[0]!.type, otras[0]!.customType)}
                                {otras.length > 1 ? ` +${otras.length - 1}` : ""}
                              </Badge>
                            )}
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
                      <Paginador {...pagina} className="pt-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ---------------- Paso 3: precios y cierre ---------------- */}
          {step === 2 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Lo pactado con cada creador</CardTitle>
                </CardHeader>
                <CardContent>
                  {lineas.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
                      Todavía no elegiste a nadie. Vuelve al paso anterior.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--line)]">
                      {lineas.map((linea, i) => {
                        const creator = creators.find((c) => c.id === linea.creatorId);
                        if (!creator) return null;
                        const { cobro, creador, ganancia } = cuentas(linea);

                        return (
                          <li key={`${linea.creatorId}-${linea.platform}-${i}`} className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar src={creator.avatarUrl} name={creator.name} size={30} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13.5px]">{creator.name}</p>
                                <p className="text-[12px] text-[var(--text-muted)]">
                                  {PLATFORM_LABEL[linea.platform]} ·{" "}
                                  {piezaLabel(linea.platform, linea.type, linea.customType)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setLineas((p) => p.filter((_, j) => j !== i))}
                                className="text-[var(--text-subtle)] hover:text-[var(--danger)]"
                                title="Quitar"
                              >
                                <X size={15} />
                              </button>
                            </div>

                            {/* Solo si tiene canales adicionales en YouTube:
                                en el resto de redes no hay dónde elegir. */}
                            {linea.platform === "youtube" && creator.channels.length > 0 && (
                              <div className="mt-2.5 pl-[42px]">
                                <Label htmlFor={`canal-${i}`}>Canal</Label>
                                <Picker
                                  id={`canal-${i}`}
                                  value={linea.channelId}
                                  onChange={(v) => cambiarCanal(i, v)}
                                  options={[
                                    {
                                      id: "",
                                      label: creator.handle || "Canal principal",
                                      hint: `Principal · ${tarifaCanal(creator, linea.platform, linea.type, "")}`,
                                    },
                                    ...creator.channels.map((c) => ({
                                      id: c.id,
                                      label: nombreCanal(c),
                                      hint: tarifaCanal(creator, linea.platform, linea.type, c.id),
                                    })),
                                  ]}
                                />
                              </div>
                            )}

                            <div className="mt-2.5 grid gap-2 pl-[42px] sm:grid-cols-[1fr_1fr]">
                              <div>
                                <Label htmlFor={`cobro-${i}`}>Pago del cliente</Label>
                                <Importe
                                  id={`cobro-${i}`}
                                  value={linea.clientPrice}
                                  onChange={(v) => editarLinea(i, { clientPrice: v })}
                                  placeholder="0"
                                />
                              </div>

                              <div>
                                <Label htmlFor={`costo-${i}`}>Costo del influencer</Label>
                                <Importe
                                  id={`costo-${i}`}
                                  value={linea.creatorCost}
                                  onChange={(v) => editarLinea(i, { creatorCost: v })}
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {/* Las tres cifras a la vista: no debe quedar duda
                                de a dónde va cada peso. */}
                            <div className="mt-2.5 ml-[42px] flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--r-control)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px]">
                              <span className="tabular font-medium">
                                {formatMoney(cobro, currency as "USD")}
                              </span>
                              <span className="text-[var(--text-subtle)]">&minus;</span>
                              <span className="tabular font-medium">
                                {formatMoney(creador, currency as "USD")}
                              </span>
                              <span className="text-[var(--text-subtle)]">=</span>
                              <span className="text-[var(--text-muted)]">ganancia bruta</span>
                              <span
                                className={cn(
                                  "tabular font-medium",
                                  ganancia < 0 ? "text-[var(--danger)]" : "text-[var(--ok)]",
                                )}
                              >
                                {formatMoney(ganancia, currency as "USD")}
                              </span>
                              {cobro > 0 && (
                                <span className="text-[var(--text-subtle)]">
                                  ({((ganancia / cobro) * 100).toFixed(0)}%)
                                </span>
                              )}
                              {creador > 0 && rateFor(creator, linea.platform, linea.type, linea.channelId) > creador && (
                                <span className="ml-auto text-[var(--warn)]">
                                  por debajo de su tarifa (
                                  {formatMoney(
                                    rateFor(creator, linea.platform, linea.type, linea.channelId),
                                    creator.currency,
                                  )}
                                  )
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

            </>
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

        {/* ---------------- Resumen ---------------- */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[13px]">
            <Fila etiqueta="Nombre" valor={name || "—"} />
            <Fila
              etiqueta="Cliente"
              valor={clientes.find((c) => c.id === companyId)?.name ?? "—"}
            />
            <Fila
              etiqueta="Objetivo"
              valor={<Badge tone="accent">{OBJECTIVES.find((o) => o.id === objective)?.label}</Badge>}
            />

            <div className="my-3 h-px bg-[var(--line)]" />

            <Fila etiqueta="Creadores" valor={String(lineas.length)} />
            <Fila
              etiqueta="Pago del cliente"
              valor={formatMoney(totales.cliente, currency as "USD")}
            />
            <Fila
              etiqueta="Costo influencers"
              valor={formatMoney(totales.creadores, currency as "USD")}
            />

            <div className="my-3 h-px bg-[var(--line)]" />

            <div className="flex items-baseline justify-between">
              <span className="text-[var(--text-muted)]">Ganancia bruta</span>
              <span className="tabular text-[15px] font-medium text-[var(--ok)]">
                {formatMoney(totales.agencia, currency as "USD")}
              </span>
            </div>
            {totales.cliente > 0 && (
              <p className="text-right text-[12px] text-[var(--text-subtle)]">
                {((totales.agencia / totales.cliente) * 100).toFixed(0)}% del total
              </p>
            )}

            {budget.trim() && Number(budget) > 0 && (
              <p className="pt-1 text-[12px] text-[var(--text-muted)]">
                {((totales.cliente / Number(budget)) * 100).toFixed(0)}% del tope de{" "}
                {formatMoney(Number(budget), currency as "USD")}
              </p>
            )}

            <p className="pt-2 text-[12px] text-[var(--text-subtle)]">
              Cada creador recibirá su propia sesión de entregas con su enlace personal.
            </p>
          </CardContent>
        </Card>
      </div>

      <QuickCompanyDialog
        open={creandoCliente}
        onClose={() => setCreandoCliente(false)}
        onCreated={(company) => {
          setClientes((prev) => [company, ...prev]);
          setCompanyId(company.id);
        }}
      />
    </div>
  );
}

/**
 * Campo de dinero.
 *
 * Guarda texto, no número: con `type="number"` y un `0` de partida, lo que
 * escribes se pega detrás y sale «02000». Aquí el campo puede estar vacío, y
 * se filtran los caracteres que no son cifra o separador decimal. Sin flechas
 * de incremento, que en importes no sirven de nada.
 */
function Importe({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      className={cn("tabular", className)}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
        // Un cero a la izquierda solo se permite en «0.algo».
        onChange(limpio.replace(/^0+(?=\d)/, ""));
      }}
    />
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--text-muted)]">{etiqueta}</span>
      <span className="truncate text-right">{valor}</span>
    </div>
  );
}

/** Tiene perfil en esa red, o es su plataforma principal. */
function estaEn(creator: Creator, platform: SocialPlatform): boolean {
  if (creator.mainPlatform === platform) return true;
  return creator.socials.some((s) => s.platform === platform);
}
