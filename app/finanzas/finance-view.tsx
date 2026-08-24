"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageTitle } from "@/components/ui/section";
import { Segmented, Toolbar } from "@/components/shell/toolbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DefList, DefRow } from "@/components/ui/def-list";
import { Stat, StatBand } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { formatMoney } from "@/lib/utils";

/** Maqueta visual: los datos son fijos hasta conectar la lógica de finanzas. */

const SERIES = [
  { mes: "Mar", ingresos: 24800, pagos: 16200 },
  { mes: "Abr", ingresos: 31200, pagos: 21400 },
  { mes: "May", ingresos: 28600, pagos: 18900 },
  { mes: "Jun", ingresos: 36400, pagos: 24800 },
  { mes: "Jul", ingresos: 42100, pagos: 29600 },
  { mes: "Ago", ingresos: 38900, pagos: 26300 },
];

type InvoiceStatus = "pagada" | "pendiente" | "vencida" | "borrador";

const INVOICES: {
  id: string;
  client: string;
  campaign: string;
  amount: number;
  issued: string;
  due: string;
  status: InvoiceStatus;
}[] = [
  {
    id: "F-2026-118",
    client: "Nova Labs",
    campaign: "Lanzamiento Suite 3.0",
    amount: 18000,
    issued: "01 ago 2026",
    due: "31 ago 2026",
    status: "pendiente",
  },
  {
    id: "F-2026-117",
    client: "Terra Bebidas",
    campaign: "Verano sin azúcar",
    amount: 9500,
    issued: "01 ago 2026",
    due: "15 ago 2026",
    status: "vencida",
  },
  {
    id: "F-2026-112",
    client: "Kairo Fintech",
    campaign: "Educación financiera",
    amount: 12000,
    issued: "30 may 2026",
    due: "29 jun 2026",
    status: "pagada",
  },
  {
    id: "F-2026-119",
    client: "Hábito Skincare",
    campaign: "Rutina de otoño",
    amount: 4200,
    issued: "—",
    due: "—",
    status: "borrador",
  },
];

const INVOICE_TONE: Record<
  InvoiceStatus,
  { label: string; tone: "ok" | "warn" | "danger" | "neutral" }
> = {
  pagada: { label: "Pagada", tone: "ok" },
  pendiente: { label: "Pendiente", tone: "warn" },
  vencida: { label: "Vencida", tone: "danger" },
  borrador: { label: "Borrador", tone: "neutral" },
};

const PAYOUTS = [
  {
    creator: "Andrés Melo",
    concept: "Video dedicado · Kairo",
    amount: 6500,
    method: "PayPal",
    status: "pagado",
  },
  {
    creator: "Valentina Ríos",
    concept: "Video + Short · Nova Labs",
    amount: 4100,
    method: "Wise",
    status: "programado",
  },
  {
    creator: "Camila Duarte",
    concept: "Short · Terra Bebidas",
    amount: 650,
    method: "Wise",
    status: "pendiente",
  },
  {
    creator: "Rodrigo Paz",
    concept: "Integración · Terra Bebidas",
    amount: 600,
    method: "Transferencia",
    status: "pendiente",
  },
];

const PAYOUT_TONE: Record<string, "ok" | "info" | "warn"> = {
  pagado: "ok",
  programado: "info",
  pendiente: "warn",
};

const SERIE_INGRESOS = SERIES.map((s) => s.ingresos);
const SERIE_PAGOS = SERIES.map((s) => s.pagos);
const SERIE_MARGEN = SERIES.map(
  (s) => Math.round(((s.ingresos - s.pagos) / s.ingresos) * 1000) / 10,
);

type TabId = "resumen" | "cobrar" | "pagos";

export function FinanceView() {
  const [tab, setTab] = useState<TabId>("resumen");

  const receivable = INVOICES.filter(
    (i) => i.status === "pendiente" || i.status === "vencida",
  ).reduce((s, i) => s + i.amount, 0);
  const payable = PAYOUTS.filter((p) => p.status !== "pagado").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-7">
      <div className="space-y-5">
        <PageTitle
          title="Finanzas"
          description="Cobros a clientes, pagos a creadores y margen de la agencia."
          actions={
            <>
              <Button variant="secondary" size="icon-lg" aria-label="Exportar">
                <Download size={18} strokeWidth={1.75} />
              </Button>
              <Button variant="primary" size="lg">
                Nueva factura
                <Plus size={17} strokeWidth={2.25} />
              </Button>
            </>
          }
        />
        <Toolbar>
          <Segmented
            options={[
              { id: "resumen", label: "Resumen" },
              { id: "cobrar", label: "Por cobrar" },
              { id: "pagos", label: "Pagos a creadores" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Badge tone="warn" className="ml-auto">
            Maqueta sin lógica conectada
          </Badge>
        </Toolbar>
      </div>

      <div className="mt-7 space-y-6">
        <StatBand>
          <Stat
            label="Facturado en agosto"
            value={formatMoney(38900)}
            delta={8.2}
            series={SERIE_INGRESOS}
          />
          <Stat
            label="Pagos a creadores"
            value={formatMoney(26300)}
            delta={-3.4}
            series={SERIE_PAGOS}
          />
          <Stat
            label="Margen bruto"
            value="32.4%"
            hint="objetivo 30%"
            series={SERIE_MARGEN}
          />
          <Stat label="Por cobrar" value={formatMoney(receivable)} hint="2 facturas abiertas" />
        </StatBand>

        {tab === "resumen" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Ingresos vs. pagos</CardTitle>
                <span className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2px] w-3 bg-[var(--accent)]" />
                    Ingresos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2px] w-3 bg-[var(--text-subtle)]" />
                    Pagos
                  </span>
                </span>
              </CardHeader>
              <div className="h-60 w-full px-2 py-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={SERIES} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="fillIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 3" stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11, fill: "var(--text-subtle)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--line)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--text-subtle)" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v: number) => `$${v / 1000}k`}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                      content={
                        <ChartTooltip
                          labels={{ ingresos: "Ingresos", pagos: "Pagos" }}
                          format={(v) => formatMoney(v)}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="ingresos"
                      stroke="var(--accent)"
                      strokeWidth={1.75}
                      fill="url(#fillIngresos)"
                    />
                    <Area
                      type="monotone"
                      dataKey="pagos"
                      stroke="var(--text-subtle)"
                      strokeWidth={1.25}
                      strokeDasharray="3 3"
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Flujo del mes</CardTitle>
                </CardHeader>
                <DefList>
                  <DefRow label="Cobrado">
                    <span className="tabular text-[var(--ok)]">{formatMoney(21400)}</span>
                  </DefRow>
                  <DefRow label="Pagado a creadores">
                    <span className="tabular">{formatMoney(18700)}</span>
                  </DefRow>
                  <DefRow label="Por pagar">
                    <span className="tabular text-[var(--warn)]">{formatMoney(payable)}</span>
                  </DefRow>
                </DefList>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Próximos vencimientos</CardTitle>
                </CardHeader>
                <ul>
                  {INVOICES.filter((i) => i.status !== "borrador").map((invoice) => {
                    const st = INVOICE_TONE[invoice.status];
                    return (
                      <li
                        key={invoice.id}
                        className="flex h-12 items-center gap-2 border-b border-[var(--line)] px-5 last:border-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{invoice.client}</span>
                          <span className="block truncate text-[11.5px] text-[var(--text-subtle)]">
                            {invoice.id} · vence {invoice.due}
                          </span>
                        </span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          </div>
        )}

        {tab === "cobrar" && (
          <Card>
            <TableWrap>
              <Table className="min-w-[840px]">
                <thead>
                  <tr>
                    <Th className="pl-4">Factura</Th>
                    <Th>Cliente</Th>
                    <Th>Campaña</Th>
                    <Th>Emitida</Th>
                    <Th>Vence</Th>
                    <Th>Estado</Th>
                    <Th align="right" className="pr-4">
                      Importe
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.map((invoice) => {
                    const st = INVOICE_TONE[invoice.status];
                    return (
                      <Tr key={invoice.id}>
                        <Td className="pl-4 font-mono text-[12px]">{invoice.id}</Td>
                        <Td className="font-medium">{invoice.client}</Td>
                        <Td className="text-[var(--text-muted)]">{invoice.campaign}</Td>
                        <Td className="text-[var(--text-muted)]">{invoice.issued}</Td>
                        <Td className="text-[var(--text-muted)]">{invoice.due}</Td>
                        <Td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Td>
                        <Td align="right" className="tabular pr-4 font-medium">
                          {formatMoney(invoice.amount)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}

        {tab === "pagos" && (
          <Card>
            <TableWrap>
              <Table className="min-w-[720px]">
                <thead>
                  <tr>
                    <Th className="pl-4">Creador</Th>
                    <Th>Concepto</Th>
                    <Th>Método</Th>
                    <Th>Estado</Th>
                    <Th align="right" className="pr-4">
                      Importe
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {PAYOUTS.map((payout) => (
                    <Tr key={payout.creator + payout.concept}>
                      <Td className="pl-4">
                        <span className="flex items-center gap-2">
                          <Avatar name={payout.creator} size={22} />
                          <span className="font-medium">{payout.creator}</span>
                        </span>
                      </Td>
                      <Td className="text-[var(--text-muted)]">{payout.concept}</Td>
                      <Td className="text-[var(--text-muted)]">{payout.method}</Td>
                      <Td>
                        <Badge tone={PAYOUT_TONE[payout.status]}>{payout.status}</Badge>
                      </Td>
                      <Td align="right" className="tabular pr-4 font-medium">
                        {formatMoney(payout.amount)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </div>
    </div>
  );
}
