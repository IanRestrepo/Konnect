"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import type { BankingInfo } from "@/lib/types";

const ROWS: { key: keyof BankingInfo; label: string; visible?: number }[] = [
  { key: "holder", label: "Titular" },
  { key: "bankName", label: "Banco" },
  { key: "accountNumber", label: "Cuenta / CLABE / IBAN", visible: 4 },
  { key: "routing", label: "SWIFT / Routing", visible: 3 },
  { key: "taxId", label: "Identificación fiscal", visible: 3 },
  { key: "paypalEmail", label: "PayPal" },
];

function maskValue(visible?: number, raw?: string) {
  return visible && raw ? `•••• ${raw.slice(-visible)}` : "••••••••";
}

export function BankingPanel({
  creatorId,
  hints,
}: {
  creatorId: string;
  /** Solo últimos dígitos, para la vista censurada. */
  hints: Partial<Record<keyof BankingInfo, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banking, setBanking] = useState<BankingInfo | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Auto-oculta a los 5 minutos (la cuenta arranca al revelar).
  useEffect(() => {
    if (!banking) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setBanking(null);
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [banking]);

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
      setBanking(data.banking as BankingInfo);
      setSecondsLeft(300);
      setOpen(false);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Información de pago</CardTitle>
          {banking ? <Badge tone="warn">Visible {mmss}</Badge> : <Badge>Protegida</Badge>}
        </CardHeader>

        <dl className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {ROWS.map((row) => {
            const value = banking?.[row.key];
            if (!banking && !hints[row.key] && row.key === "paypalEmail") return null;
            return (
              <div
                key={row.key}
                className="flex min-h-12 items-center justify-between gap-4 px-5 py-2"
              >
                <dt className="text-[13px] text-[var(--text-muted)]">{row.label}</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={
                      banking
                        ? "truncate font-mono text-[13px]"
                        : "truncate font-mono text-[13px] text-[var(--text-subtle)] select-none"
                    }
                  >
                    {banking ? String(value ?? "—") : maskValue(row.visible, hints[row.key])}
                  </span>
                  {banking && value && (
                    <button
                      onClick={() => navigator.clipboard.writeText(String(value))}
                      className="shrink-0 rounded-[var(--r-control)] p-0.5 text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                      aria-label={`Copiar ${row.label}`}
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
          <p className="text-[12px] text-[var(--text-subtle)]">
            Cifrada con AES-256 · cada consulta se audita
          </p>
          {banking ? (
            <Button variant="secondary" size="sm" onClick={() => setBanking(null)}>
              <EyeOff size={13} />
              Ocultar
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Eye size={13} />
              Ver datos
            </Button>
          )}
        </div>
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
        description="Introduce el código de acceso para ver la información bancaria."
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
