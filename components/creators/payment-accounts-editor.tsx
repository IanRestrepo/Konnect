"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { PAYMENT_FIELDS, PAYMENT_METHOD } from "@/lib/labels";
import type { BankingAccount, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const METODOS = Object.keys(PAYMENT_METHOD) as PaymentMethod[];

/** Cuenta recién elegida: sin datos, con el método puesto. */
function cuentaVacia(method: PaymentMethod): BankingAccount {
  return {
    id: "",
    method,
    label: "",
    holder: "",
    bankName: "",
    reference: "",
    routing: "",
    notes: "",
  };
}

/**
 * Editor de las cuentas por las que cobra un creador.
 *
 * Los métodos y las cuentas van juntos a propósito: marcar «PayPal» y no dejar
 * dónde escribir el correo es lo que obligaba a apuntar el dato en las notas.
 * Al encender un método aparece su cuenta; al apagarlo se va con sus datos.
 *
 * Cada método pide lo suyo (`PAYMENT_FIELDS`): un banco quiere CLABE y SWIFT,
 * un PayPal sólo un correo.
 */
export function PaymentAccountsEditor({
  methods,
  accounts,
  onChange,
  className,
}: {
  methods: PaymentMethod[];
  accounts: BankingAccount[];
  onChange: (methods: PaymentMethod[], accounts: BankingAccount[]) => void;
  className?: string;
}) {
  function alternar(method: PaymentMethod) {
    if (methods.includes(method)) {
      onChange(
        methods.filter((m) => m !== method),
        accounts.filter((a) => a.method !== method),
      );
    } else {
      onChange([...methods, method], [...accounts, cuentaVacia(method)]);
    }
  }

  function cambiar(i: number, patch: Partial<BankingAccount>) {
    onChange(
      methods,
      accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)),
    );
  }

  function quitar(i: number) {
    const restantes = accounts.filter((_, j) => j !== i);
    const method = accounts[i]!.method;
    // Si era la última cuenta de ese método, el método también se apaga.
    const sigue = restantes.some((a) => a.method === method);
    onChange(sigue ? methods : methods.filter((m) => m !== method), restantes);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label>Métodos de pago</Label>
        <div className="flex flex-wrap gap-1.5">
          {METODOS.map((m) => {
            const activo = methods.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => alternar(m)}
                aria-pressed={activo}
                className={cn(
                  "h-8 rounded-[var(--r-pill)] border px-3 text-[12.5px] font-medium transition",
                  activo
                    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                {PAYMENT_METHOD[m]}
              </button>
            );
          })}
        </div>
        <FieldHint>Marca por dónde cobra y rellena cada cuenta debajo.</FieldHint>
      </div>

      {accounts.map((cuenta, i) => {
        const campos = PAYMENT_FIELDS[cuenta.method];
        return (
          <div
            key={`${cuenta.method}-${cuenta.id || i}`}
            className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] p-3"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="inline-flex h-6 items-center rounded-[var(--r-pill)] bg-[var(--accent-soft)] px-2.5 text-[11.5px] font-medium text-[var(--accent)]">
                {PAYMENT_METHOD[cuenta.method]}
              </span>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar cuenta de ${PAYMENT_METHOD[cuenta.method]}`}
                className="grid h-7 w-7 place-items-center rounded-[var(--r-control)] text-[var(--text-subtle)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className={campos.bank ? undefined : "sm:col-span-2"}>
                <Label htmlFor={`pa-ref-${i}`}>{campos.reference}</Label>
                <Input
                  id={`pa-ref-${i}`}
                  value={cuenta.reference}
                  onChange={(e) => cambiar(i, { reference: e.target.value })}
                  placeholder={campos.referencePlaceholder}
                />
              </div>

              {campos.bank && (
                <div>
                  <Label htmlFor={`pa-banco-${i}`}>Banco</Label>
                  <Input
                    id={`pa-banco-${i}`}
                    value={cuenta.bankName}
                    onChange={(e) => cambiar(i, { bankName: e.target.value })}
                    placeholder="Bancolombia"
                  />
                </div>
              )}

              <div>
                <Label htmlFor={`pa-titular-${i}`}>Titular</Label>
                <Input
                  id={`pa-titular-${i}`}
                  value={cuenta.holder}
                  onChange={(e) => cambiar(i, { holder: e.target.value })}
                  placeholder="A nombre de quién está"
                />
              </div>

              {campos.routing && (
                <div>
                  <Label htmlFor={`pa-routing-${i}`}>{campos.routing}</Label>
                  <Input
                    id={`pa-routing-${i}`}
                    value={cuenta.routing}
                    onChange={(e) => cambiar(i, { routing: e.target.value })}
                    placeholder={campos.routingPlaceholder}
                  />
                </div>
              )}

              <div>
                <Label htmlFor={`pa-alias-${i}`}>Alias</Label>
                <Input
                  id={`pa-alias-${i}`}
                  value={cuenta.label}
                  onChange={(e) => cambiar(i, { label: e.target.value })}
                  placeholder="Cómo la llama el equipo"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor={`pa-notas-${i}`}>Nota</Label>
                <Input
                  id={`pa-notas-${i}`}
                  value={cuenta.notes}
                  onChange={(e) => cambiar(i, { notes: e.target.value })}
                  placeholder="Cobra aquí sólo si supera los 500 USD…"
                />
              </div>
            </div>

            {/* Un creador puede tener dos bancos, o dos PayPal a nombre distinto. */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() =>
                onChange(methods, [
                  ...accounts.slice(0, i + 1),
                  cuentaVacia(cuenta.method),
                  ...accounts.slice(i + 1),
                ])
              }
            >
              <Plus size={13} />
              Otra cuenta de {PAYMENT_METHOD[cuenta.method]}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
