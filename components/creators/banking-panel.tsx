"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, Loader2, Pencil, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useCan } from "@/components/session-provider";
import { PaymentAccountsEditor } from "@/components/creators/payment-accounts-editor";
import { PAYMENT_FIELDS, PAYMENT_METHOD } from "@/lib/labels";
import type { BankingAccount, BankingInfo, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Cuánto tiempo se quedan a la vista los datos tras revelarlos. */
const VISIBLE_MS = 5 * 60 * 1000;

/**
 * Los campos de la ficha vieja, de cuando sólo había una cuenta. Se siguen
 * pintando porque las fichas de antes tienen ahí sus datos; las nuevas cuelgan
 * de `accounts`.
 */
const HEREDADOS: { key: keyof BankingInfo; label: string; visible?: number }[] = [
  { key: "bankName", label: "Banco" },
  { key: "accountNumber", label: "Cuenta / CLABE / IBAN", visible: 4 },
  { key: "routing", label: "SWIFT / Routing", visible: 3 },
  { key: "paypalEmail", label: "PayPal" },
];

function maskValue(visible?: number, raw?: string) {
  return visible && raw ? `•••• ${raw.slice(-visible)}` : "••••••••";
}

/** Fila de dato: censurada hasta que se revela, con botón de copiar. */
function Fila({
  label,
  value,
  hint,
  visible,
  revelado,
  /** Las filas sueltas llevan el margen de la tarjeta; las de una cuenta ya lo tienen. */
  sangrada = true,
}: {
  label: string;
  value: string;
  hint: string;
  visible?: number;
  revelado: boolean;
  sangrada?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2",
        sangrada ? "min-h-12 px-5" : "min-h-9",
      )}
    >
      <dt className="shrink-0 text-[13px] text-[var(--text-muted)]">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span
          className={
            revelado
              ? "truncate font-mono text-[13px]"
              : "truncate font-mono text-[13px] text-[var(--text-subtle)] select-none"
          }
        >
          {revelado ? value || "—" : maskValue(visible, hint)}
        </span>
        {revelado && value && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="shrink-0 rounded-[var(--r-control)] p-0.5 text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
            aria-label={`Copiar ${label}`}
          >
            <Copy size={12} />
          </button>
        )}
      </dd>
    </div>
  );
}

/**
 * Información de pago del creador: su identidad fiscal y las cuentas por las
 * que cobra.
 *
 * Editar exige haber revelado antes, y no por ceremonia: lo que llega del
 * servidor son los últimos dígitos, así que sin descifrar no hay nada que
 * corregir —guardar la vista censurada escribiría «4321» como número de
 * cuenta y se perdería el dato bueno.
 */
export function BankingPanel({
  creatorId,
  banking,
  accounts,
  methods,
}: {
  creatorId: string;
  /** Versión censurada que llega del servidor. */
  banking: BankingInfo;
  accounts: BankingAccount[];
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const can = useCan();
  const puedeEditar = can("editar_creadores") && can("ver_datos_bancarios");

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claro, setClaro] = useState<{ banking: BankingInfo; accounts: BankingAccount[] } | null>(
    null,
  );
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<{
    holder: string;
    taxId: string;
    notes: string;
    methods: PaymentMethod[];
    accounts: BankingAccount[];
  } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  /** Vuelve a censurar. Si se estaba editando, el formulario se va con los
   *  datos: sin descifrar no hay nada que corregir. */
  function ocultar() {
    setClaro(null);
    setEditando(false);
    setBorrador(null);
    setSecondsLeft(0);
  }

  // Auto-oculta a los 5 minutos. El cierre va en su propio temporizador y no
  // dentro de la cuenta atrás: el contador es sólo lo que se pinta.
  useEffect(() => {
    if (!claro) return;
    const tic = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const fin = setTimeout(ocultar, VISIBLE_MS);
    return () => {
      clearInterval(tic);
      clearTimeout(fin);
    };
  }, [claro]);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/creadores/${creatorId}/revelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo validar el código.");
      setClaro({
        banking: data.banking as BankingInfo,
        accounts: (data.accounts ?? []) as BankingAccount[],
      });
      setSecondsLeft(VISIBLE_MS / 1000);
      setOpen(false);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function empezarEdicion() {
    if (!claro) return;
    setBorrador({
      holder: claro.banking.holder,
      taxId: claro.banking.taxId,
      notes: claro.banking.notes ?? "",
      // Los métodos siguen a las cuentas: si hay uno marcado sin cuenta, se
      // conserva para no borrar en silencio lo que había en la ficha.
      methods: [...new Set([...methods, ...claro.accounts.map((a) => a.method)])],
      accounts: claro.accounts,
    });
    setErrorGuardar(null);
    setEditando(true);
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const cuentas = borrador.accounts
        .filter((c) => c.reference.trim())
        .map((c) => ({
          method: c.method,
          label: c.label.trim(),
          holder: c.holder.trim() || borrador.holder.trim(),
          bankName: c.bankName.trim(),
          reference: c.reference.trim(),
          routing: c.routing.trim(),
          notes: c.notes.trim(),
        }));

      const res = await fetch(`/api/creadores/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethods: borrador.methods,
          // Se manda entero: mandar sólo lo cambiado dejaría lo demás cifrado
          // con datos viejos y sin forma de saber cuál manda.
          banking: {
            holder: borrador.holder.trim(),
            bankName: claro?.banking.bankName ?? "",
            accountNumber: claro?.banking.accountNumber ?? "",
            routing: claro?.banking.routing ?? "",
            taxId: borrador.taxId.trim(),
            paypalEmail: claro?.banking.paypalEmail ?? "",
            notes: borrador.notes.trim(),
          },
          bankAccounts: cuentas,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la información de pago.");

      // Lo guardado pasa a ser lo revelado: el temporizador sigue corriendo.
      setClaro({
        banking: {
          ...(claro?.banking ?? { bankName: "", accountNumber: "", routing: "" }),
          holder: borrador.holder.trim(),
          taxId: borrador.taxId.trim(),
          notes: borrador.notes.trim(),
        } as BankingInfo,
        accounts: cuentas.map((c, i) => ({ ...c, id: `tmp-${i}` })),
      });
      setEditando(false);
      router.refresh();
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const visibles = claro ? claro.accounts : accounts;
  const heredados = HEREDADOS.filter((r) => claro?.banking[r.key] || banking[r.key]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Información de pago</CardTitle>
          {claro ? <Badge tone="warn">Visible {mmss}</Badge> : <Badge>Protegida</Badge>}
        </CardHeader>

        {editando && borrador ? (
          <div className="space-y-3 border-t border-[var(--line)] p-4">
            {errorGuardar && (
              <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
                <ShieldAlert size={14} className="mt-px shrink-0" />
                {errorGuardar}
              </p>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <Label htmlFor="bk-holder">Titular fiscal</Label>
                <Input
                  id="bk-holder"
                  value={borrador.holder}
                  onChange={(e) => setBorrador({ ...borrador, holder: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <Label htmlFor="bk-taxid">Identificación fiscal</Label>
                <Input
                  id="bk-taxid"
                  value={borrador.taxId}
                  onChange={(e) => setBorrador({ ...borrador, taxId: e.target.value })}
                  placeholder="RFC / NIT / CUIT"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bk-notes">Nota de pago</Label>
                <Input
                  id="bk-notes"
                  value={borrador.notes}
                  onChange={(e) => setBorrador({ ...borrador, notes: e.target.value })}
                  placeholder="Factura a nombre de su empresa, paga los días 15…"
                />
              </div>
            </div>

            <PaymentAccountsEditor
              methods={borrador.methods}
              accounts={borrador.accounts}
              onChange={(m, c) => setBorrador({ ...borrador, methods: m, accounts: c })}
            />

            <div className="flex items-center justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={guardar} disabled={guardando}>
                {guardando && <Loader2 size={13} className="animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <dl className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
              <Fila
                label="Titular"
                value={claro?.banking.holder ?? ""}
                hint={banking.holder}
                revelado={Boolean(claro)}
              />
              <Fila
                label="Identificación fiscal"
                value={claro?.banking.taxId ?? ""}
                hint={banking.taxId}
                visible={3}
                revelado={Boolean(claro)}
              />
              {heredados.map((row) => (
                <Fila
                  key={row.key}
                  label={row.label}
                  value={String(claro?.banking[row.key] ?? "")}
                  hint={String(banking[row.key] ?? "")}
                  visible={row.visible}
                  revelado={Boolean(claro)}
                />
              ))}
            </dl>

            {visibles.length > 0 && (
              <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {visibles.map((cuenta, i) => {
                  const campos = PAYMENT_FIELDS[cuenta.method];
                  return (
                    <div key={cuenta.id || i} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone="accent" plain>
                          {PAYMENT_METHOD[cuenta.method]}
                        </Badge>
                        <span className="truncate text-[12px] text-[var(--text-subtle)]">
                          {cuenta.label || cuenta.bankName || cuenta.holder || "Sin alias"}
                        </span>
                      </div>
                      <dl className="mt-1">
                        <Fila
                          label={campos.reference}
                          value={cuenta.reference}
                          hint={cuenta.reference}
                          visible={4}
                          revelado={Boolean(claro)}
                          sangrada={false}
                        />
                        {campos.routing && (cuenta.routing || claro) && (
                          <Fila
                            label={campos.routing}
                            value={cuenta.routing}
                            hint={cuenta.routing}
                            visible={3}
                            revelado={Boolean(claro)}
                            sangrada={false}
                          />
                        )}
                      </dl>
                      {claro && cuenta.notes && (
                        <p className="text-[12px] text-[var(--text-subtle)]">{cuenta.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {visibles.length === 0 && heredados.length === 0 && (
              <p className="border-t border-[var(--line)] px-5 py-3 text-[12.5px] text-[var(--text-muted)]">
                Sin cuentas de cobro registradas.
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
              <p className="text-[12px] text-[var(--text-subtle)]">
                Cifrada con AES-256 · cada consulta se audita
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {claro ? (
                  <>
                    {puedeEditar && (
                      <Button variant="secondary" size="sm" onClick={empezarEdicion}>
                        <Pencil size={13} />
                        Editar
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={ocultar}>
                      <EyeOff size={13} />
                      Ocultar
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                    <Eye size={13} />
                    Ver datos
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
          setCode("");
        }}
        size="sm"
        title="Verificación requerida"
        description="Introduce el código de acceso para ver o cambiar la información bancaria."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={reveal} disabled={loading || code.length < 4}>
              {loading && <Loader2 size={13} className="animate-spin" />}
              Desbloquear
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="access-code">Código de acceso</Label>
            <Input
              id="access-code"
              type="password"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code.length >= 4 && reveal()}
              placeholder="••••••"
              className="h-9 text-center font-mono text-[15px] tracking-[0.4em]"
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-[var(--r-control)] bg-[var(--danger-soft)] px-2.5 py-2 text-[12px] text-[var(--danger)]">
              <ShieldAlert size={13} className="mt-px shrink-0" />
              {error}
            </p>
          )}

          <p className="text-[12px] text-[var(--text-subtle)]">
            Cinco intentos fallidos bloquean el acceso 10 minutos. La sesión desbloqueada expira a
            los 5 minutos.
          </p>
        </div>
      </Modal>
    </>
  );
}
