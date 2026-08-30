"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, SlidersHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Picker } from "@/components/ui/picker";
import { Popover } from "@/components/ui/popover";
import { TableWrap, Table, Th, Tr, Td } from "@/components/ui/table";
import { DELIVERABLE_STATUS, DELIVERABLE_TYPE } from "@/lib/labels";
import { PLATFORM_LABEL } from "@/lib/socials";
import { formatCompact, formatDate } from "@/lib/utils";
import type { DeliverableStatus, DeliverableType, SocialPlatform } from "@/lib/types";

export type MetricRow = {
  id: string;
  title: string;
  creator: string;
  platform: SocialPlatform;
  type: DeliverableType;
  status: DeliverableStatus;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  /** El creador tiene YouTube conectado: sus columnas de analítica se llenarán. */
  hasAnalytics: boolean;
};

type RangoId = "todo" | "7" | "28" | "90";

const RANGOS: { id: RangoId; label: string }[] = [
  { id: "todo", label: "Toda la campaña" },
  { id: "7", label: "Últimos 7 días" },
  { id: "28", label: "Últimos 28 días" },
  { id: "90", label: "Últimos 90 días" },
];

type ColKey =
  | "estado"
  | "vistas"
  | "likes"
  | "comentarios"
  | "interacciones"
  | "engagement"
  | "publicado"
  | "retencion"
  | "pctVisto"
  | "subsGanados"
  | "trafico"
  | "ingresos";

type Col = {
  key: ColKey;
  label: string;
  /** Solo se llena con la YouTube Analytics API; hoy sale "—". */
  analitica?: boolean;
  valor: (r: MetricRow) => number | null;
};

const interacciones = (r: MetricRow) => (r.likes ?? 0) + (r.comments ?? 0);
const engagement = (r: MetricRow) => (r.views ? (interacciones(r) / r.views) * 100 : null);

const COLS: Col[] = [
  { key: "estado", label: "Estado", valor: () => null },
  { key: "vistas", label: "Vistas", valor: (r) => r.views },
  { key: "likes", label: "Me gusta", valor: (r) => r.likes },
  { key: "comentarios", label: "Comentarios", valor: (r) => r.comments },
  { key: "interacciones", label: "Interacciones", valor: (r) => interacciones(r) },
  { key: "engagement", label: "Engagement", valor: engagement },
  { key: "publicado", label: "Publicado", valor: () => null },
  { key: "retencion", label: "Retención media", analitica: true, valor: () => null },
  { key: "pctVisto", label: "% del video visto", analitica: true, valor: () => null },
  { key: "subsGanados", label: "Suscriptores ganados", analitica: true, valor: () => null },
  { key: "trafico", label: "Fuente principal", analitica: true, valor: () => null },
  { key: "ingresos", label: "Ingresos est.", analitica: true, valor: () => null },
];

const POR_DEFECTO: ColKey[] = ["estado", "vistas", "interacciones", "engagement", "publicado"];
const ALMACEN = "konnect.campaign-metrics";

type Guardado = { cols: ColKey[]; rango: RangoId; sortKey: SortKey; sortDir: "asc" | "desc" };
type SortKey = "entregable" | ColKey;

function leerGuardado(): Partial<Guardado> {
  try {
    return JSON.parse(localStorage.getItem(ALMACEN) || "{}");
  } catch {
    return {};
  }
}

const alineadaDerecha = (k: SortKey) =>
  k !== "entregable" && k !== "estado" && k !== "publicado" && k !== "trafico";

export function CampaignMetrics({
  rows,
  connectedCreators,
}: {
  rows: MetricRow[];
  /** Nombres de los creadores con YouTube conectado, para el pie de nota. */
  connectedCreators: string[];
}) {
  const router = useRouter();

  // El estado arranca en los valores por defecto —iguales en servidor y
  // cliente, sin desajuste de hidratación— y las preferencias guardadas se
  // aplican tras montar.
  const [visibles, setVisibles] = useState<ColKey[]>(POR_DEFECTO);
  const [rango, setRango] = useState<RangoId>("todo");
  const [sortKey, setSortKey] = useState<SortKey>("vistas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Referencia de "ahora" fijada al montar: el filtro por rango no necesita más
  // precisión y así el render se mantiene puro.
  const [ahora] = useState(() => Date.now());

  useEffect(() => {
    const g = leerGuardado();
    // Aplicar las preferencias guardadas una sola vez, tras montar: leer
    // localStorage durante el render rompería la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (g.cols?.length) setVisibles(g.cols);
    if (g.rango) setRango(g.rango);
    if (g.sortKey) setSortKey(g.sortKey);
    if (g.sortDir) setSortDir(g.sortDir);
  }, []);

  function persistir(patch: Partial<Guardado>) {
    const actual: Guardado = { cols: visibles, rango, sortKey, sortDir, ...patch };
    try {
      localStorage.setItem(ALMACEN, JSON.stringify(actual));
    } catch {
      // sin almacenamiento: se pierde la preferencia, no pasa nada
    }
  }

  function toggleCol(key: ColKey) {
    const next = visibles.includes(key)
      ? visibles.filter((k) => k !== key)
      : [...visibles, key];
    setVisibles(next);
    persistir({ cols: next });
  }

  function ordenarPor(key: SortKey) {
    if (key === sortKey) {
      const dir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(dir);
      persistir({ sortDir: dir });
    } else {
      setSortKey(key);
      setSortDir("desc");
      persistir({ sortKey: key, sortDir: "desc" });
    }
  }

  const filtradas = useMemo(() => {
    let base = rows;
    if (rango !== "todo") {
      const limite = ahora - Number(rango) * 86_400_000;
      base = rows.filter((r) => r.publishedAt && new Date(r.publishedAt).getTime() >= limite);
    }
    const col = COLS.find((c) => c.key === sortKey);
    const clave = (r: MetricRow): number | string => {
      if (sortKey === "entregable") return r.title.toLowerCase();
      if (sortKey === "publicado") return r.publishedAt ? new Date(r.publishedAt).getTime() : 0;
      if (sortKey === "estado") return r.status;
      return col?.valor(r) ?? -1;
    };
    return [...base].sort((a, b) => {
      const va = clave(a);
      const vb = clave(b);
      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : va - Number(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, rango, sortKey, sortDir, ahora]);

  const totales = useMemo(() => {
    const v = filtradas.reduce((s, r) => s + (r.views ?? 0), 0);
    const i = filtradas.reduce((s, r) => s + interacciones(r), 0);
    return {
      vistas: v,
      likes: filtradas.reduce((s, r) => s + (r.likes ?? 0), 0),
      comentarios: filtradas.reduce((s, r) => s + (r.comments ?? 0), 0),
      interacciones: i,
      engagement: v ? (i / v) * 100 : null,
    };
  }, [filtradas]);

  const cols = COLS.filter((c) => visibles.includes(c.key));
  const num = (n: number | null | undefined) => (n == null ? "—" : formatCompact(n));
  const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(2)}%`);

  function celda(c: Col, r: MetricRow) {
    switch (c.key) {
      case "estado": {
        const st = DELIVERABLE_STATUS[r.status];
        return <Badge tone={st.tone}>{st.label}</Badge>;
      }
      case "publicado":
        return r.publishedAt ? formatDate(r.publishedAt) : "—";
      case "engagement":
        return pct(engagement(r));
      case "retencion":
      case "pctVisto":
      case "subsGanados":
      case "trafico":
      case "ingresos":
        return <span className="text-[var(--text-subtle)]">{r.hasAnalytics ? "—" : "n/d"}</span>;
      default:
        return num(c.valor(r));
    }
  }

  const flecha = (k: SortKey) =>
    sortKey === k ? (
      sortDir === "asc" ? (
        <ArrowUp size={12} className="inline" />
      ) : (
        <ArrowDown size={12} className="inline" />
      )
    ) : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Métricas</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-subtle)]">
            {filtradas.length} {filtradas.length === 1 ? "entregable" : "entregables"} en el periodo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Picker
            value={rango}
            onChange={(r) => {
              setRango(r);
              persistir({ rango: r });
            }}
            options={RANGOS.map((r) => ({ id: r.id, label: r.label }))}
            className="w-44"
          />

          <Popover
            side="bottom"
            align="end"
            trigger={({ toggle }) => (
              <Button variant="secondary" size="md" onClick={toggle}>
                <SlidersHorizontal size={14} />
                Columnas
              </Button>
            )}
          >
            {() => (
              <div className="max-h-80 overflow-y-auto p-1">
                {COLS.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[var(--r-chip)] px-2.5 py-2 text-[13px] transition hover:bg-[var(--surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibles.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="flex-1">{c.label}</span>
                    {c.analitica && (
                      <span className="text-[11px] text-[var(--text-subtle)]">analítica</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </Popover>

          <Button
            variant="secondary"
            size="icon"
            aria-label="Actualizar"
            onClick={() => router.refresh()}
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th
                className="sticky left-0 z-10 cursor-pointer bg-[var(--surface-2)] select-none"
                onClick={() => ordenarPor("entregable")}
              >
                Entregable {flecha("entregable")}
              </Th>
              {cols.map((c) => (
                <Th
                  key={c.key}
                  align={alineadaDerecha(c.key) ? "right" : "left"}
                  className="cursor-pointer select-none"
                  onClick={() => ordenarPor(c.key)}
                >
                  {c.label} {flecha(c.key)}
                </Th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <Td colSpan={cols.length + 1} className="text-center text-[var(--text-muted)]">
                  Sin entregables en el periodo elegido.
                </Td>
              </tr>
            ) : (
              filtradas.map((r) => (
                <Tr key={r.id}>
                  <Td className="sticky left-0 z-10 bg-[var(--surface)]">
                    <span className="block max-w-[220px] truncate font-medium">
                      {r.title || "Sin publicar"}
                    </span>
                    <span className="block truncate text-[11.5px] text-[var(--text-subtle)]">
                      {r.creator} · {PLATFORM_LABEL[r.platform]} · {DELIVERABLE_TYPE[r.type]}
                    </span>
                  </Td>
                  {cols.map((c) => (
                    <Td
                      key={c.key}
                      align={alineadaDerecha(c.key) ? "right" : "left"}
                      className={alineadaDerecha(c.key) ? "tabular" : undefined}
                    >
                      {celda(c, r)}
                    </Td>
                  ))}
                </Tr>
              ))
            )}
          </tbody>

          {filtradas.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--line-strong)]">
                <Td className="sticky left-0 z-10 bg-[var(--surface-2)] font-medium">Total</Td>
                {cols.map((c) => (
                  <Td
                    key={c.key}
                    align={alineadaDerecha(c.key) ? "right" : "left"}
                    className={
                      "bg-[var(--surface-2)] " +
                      (alineadaDerecha(c.key) ? "tabular font-medium" : "")
                    }
                  >
                    {c.key === "vistas"
                      ? formatCompact(totales.vistas)
                      : c.key === "likes"
                        ? formatCompact(totales.likes)
                        : c.key === "comentarios"
                          ? formatCompact(totales.comentarios)
                          : c.key === "interacciones"
                            ? formatCompact(totales.interacciones)
                            : c.key === "engagement"
                              ? pct(totales.engagement)
                              : ""}
                  </Td>
                ))}
              </tr>
            </tfoot>
          )}
        </Table>
      </TableWrap>

      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
        Las columnas marcadas <span className="text-[var(--text-muted)]">analítica</span> se llenan
        con la YouTube Analytics API cuando el creador conecta su cuenta y se sincroniza
        {connectedCreators.length > 0 && ` (ya conectados: ${connectedCreators.join(", ")})`}.
        {" "}<span className="text-[var(--text-muted)]">n/d</span> = ese creador no tiene YouTube
        conectado.
      </p>
    </section>
  );
}
